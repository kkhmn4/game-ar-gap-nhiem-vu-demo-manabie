import re
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path("qa-output")
out.mkdir(exist_ok=True)
errors = []
failed_resources = []
failed_requests = []

engine_source = Path("src/utils/engine.ts").read_text(encoding="utf-8")
game_source = Path("src/components/Game.tsx").read_text(encoding="utf-8")
app_source = Path("src/App.tsx").read_text(encoding="utf-8")
css_source = Path("src/index.css").read_text(encoding="utf-8")
fall_scale_match = re.search(r"const FALL_SPEED_SCALE = ([0-9.]+);", engine_source)
fall_scale = float(fall_scale_match.group(1)) if fall_scale_match else None
assert fall_scale == 0.35, f"Unexpected fall speed scale: {fall_scale}"
assert engine_source.count("fallSpeed:") == 4, "All three modes must define fallSpeed"
assert engine_source.count("fallSpeed: 0.") == 3, "All three modes must use the shared scale"
assert "frameDamping" in engine_source, "Ball easing must be time-based"
assert "const MAX_PHYSICS_STEP_MS = 1000 / 120" in game_source, "Physics must use short sub-steps"
assert "UI_STATE_PUBLISH_INTERVAL_MS" in game_source, "HUD updates must be throttled away from canvas FPS"
assert "MAX_CANVAS_PIXEL_RATIO" in game_source, "Canvas must render at device-aware pixel density"
assert "imageSmoothingQuality = 'high'" in game_source, "Atlas scaling must use high-quality smoothing"
assert "ctx.setTransform(pixelRatioRef.current" in game_source, "Canvas must map HiDPI backing pixels to CSS coordinates"
assert "CANVAS_RENDER_SCALE" not in game_source, "Low-resolution canvas upscaling makes falling orbs blurry"
assert "workshop-replay-motion" in app_source, "Opening motion must be replayable without reloading"
assert "workshop-morph-gate" in app_source, "Opening needs a visible AI portal morph"
assert "debrief-replay-motion" in app_source, "Debrief motion must be replayable"
assert "debrief-morph-bridge" in app_source, "Debrief needs a visible chapter-transition morph"
assert ".workshop-stage.force-motion .workshop-morph-gate" in css_source, "Presenter motion must not collapse to 0.001 ms"
assert "06 sản phẩm cốt lõi" not in app_source, "Do not introduce wording absent from KHBD V5.2"
assert "Nêu tiêu chí phân loại hai nhóm việc" not in app_source, "Question 1 must match the worksheet verbatim"
assert "CHỐT LẦN 1 · CĂN CỨ PHÂN LOẠI CÔNG VIỆC" in app_source
assert "CHÍNH LÀ 06 VIỆC CỦA 180 PHÚT SẮP TỚI" in app_source
assert "Căn cứ nào để xếp một công việc vào nhóm giao được cho trí tuệ nhân tạo?" in app_source
assert "Mở mục 1.2" in app_source and "Nộp bài" in app_source

with sync_playwright() as p:
    chrome = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
    launch_options = {"headless": True}
    if chrome.exists():
        launch_options["executable_path"] = str(chrome)
    browser = p.chromium.launch(**launch_options)
    page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page.on("console", lambda msg: errors.append(f"console:{msg.type}:{msg.text}:{msg.location}") if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(f"page:{exc}"))
    page.on("response", lambda response: failed_resources.append(f"{response.status}:{response.url}") if response.status >= 400 else None)
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.url}:{request.failure}"))
    page.goto("http://127.0.0.1:4173", wait_until="domcontentloaded")
    page.locator(".workshop-stage").wait_for()
    page.wait_for_timeout(500)
    page.screenshot(path=str(out / "intro-motion-frame.png"), full_page=False)
    motion = page.locator(".workshop-scanline").evaluate("el => getComputedStyle(el).animationName")
    intro_title_motion = page.locator(".workshop-title > span").first.evaluate("el => getComputedStyle(el).animationName")
    intro_arena_motion = page.locator(".workshop-arena").evaluate("el => getComputedStyle(el).animationName")
    page.locator(".workshop-replay-motion").click()
    page.wait_for_timeout(650)
    portal_duration = page.locator(".workshop-morph-gate").evaluate("el => getComputedStyle(el).animationDuration")
    portal_visibility = page.locator(".workshop-morph-gate").evaluate("el => getComputedStyle(el).visibility")
    page.screenshot(path=str(out / "intro-morph-clicked.png"), full_page=False)
    page.wait_for_timeout(2850)
    page.screenshot(path=str(out / "intro-live.png"), full_page=False)
    orbs = page.locator(".workshop-mission").count()
    no_horizontal_overflow = page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    no_vertical_overflow = page.evaluate("document.documentElement.scrollHeight <= document.documentElement.clientHeight")
    kicker_box = page.locator(".workshop-kicker").bounding_box()
    title_box = page.locator(".workshop-title").bounding_box()
    intro_text_separated = bool(kicker_box and title_box and title_box["y"] >= kicker_box["y"] + kicker_box["height"] - 1)
    selected_modes = []
    speed_buttons = page.locator(".workshop-speed button")
    for index, mode in enumerate(("easy", "normal", "hard")):
        button = speed_buttons.nth(index)
        button.click()
        selected_modes.append((mode, button.get_attribute("aria-pressed")))

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    mobile.goto("http://127.0.0.1:4173", wait_until="domcontentloaded")
    mobile.locator(".workshop-stage").wait_for()
    mobile.wait_for_timeout(3500)
    mobile.screenshot(path=str(out / "intro-mobile.png"), full_page=True)
    mobile_overflow = mobile.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    mobile_kicker = mobile.locator(".workshop-kicker").bounding_box()
    mobile_title = mobile.locator(".workshop-title").bounding_box()
    mobile_text_separated = bool(mobile_kicker and mobile_title and mobile_title["y"] >= mobile_kicker["y"] + mobile_kicker["height"] - 1)
    mobile.close()

    debrief = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    debrief.goto("http://127.0.0.1:4173/?qa=debrief", wait_until="domcontentloaded")
    debrief.get_by_text("CHỐT LẦN 1 · CĂN CỨ PHÂN LOẠI CÔNG VIỆC").wait_for()
    debrief.wait_for_timeout(900)
    debrief.screenshot(path=str(out / "debrief-result-start.png"), full_page=False)
    debrief.wait_for_timeout(1700)
    debrief.screenshot(path=str(out / "debrief-result-climax.png"), full_page=False)
    debrief.wait_for_timeout(2800)
    debrief.screenshot(path=str(out / "debrief-result-settled.png"), full_page=False)
    debrief_no_horizontal_overflow = debrief.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    debrief_has_vertical_scroll = debrief.locator(".debrief-v3").evaluate("el => el.scrollHeight > el.clientHeight * 2.2")
    debrief_missions = debrief.locator(".debrief-missions article").count()
    result_motion = debrief.locator(".result-beat-one").evaluate("el => ({name: getComputedStyle(el).animationName, duration: getComputedStyle(el).animationDuration})")
    result_lock_visible = float(debrief.locator(".result-lock").evaluate("el => getComputedStyle(el).opacity")) > 0.9
    scroll_cues = debrief.locator(".debrief-scroll-cue").count()
    scroll_start = debrief.locator(".debrief-v3").evaluate("el => el.scrollTop")
    debrief.locator("#debrief-result .debrief-scroll-cue").click()
    debrief.wait_for_timeout(420)
    debrief.screenshot(path=str(out / "debrief-role-motion-frame.png"), full_page=False)
    debrief.wait_for_timeout(1000)
    scroll_role = debrief.locator(".debrief-v3").evaluate("el => el.scrollTop")
    role_reveals = debrief.locator("#debrief-role [data-reveal].is-visible").count()
    role_image_motion = debrief.locator("#debrief-role figure").first.evaluate("el => getComputedStyle(el).animationName")
    debrief.screenshot(path=str(out / "debrief-role-live.png"), full_page=False)
    debrief.locator("#debrief-role .debrief-scroll-cue").click()
    debrief.wait_for_timeout(450)
    debrief.screenshot(path=str(out / "debrief-close-start.png"), full_page=False)
    debrief.wait_for_timeout(2450)
    debrief.screenshot(path=str(out / "debrief-close-climax.png"), full_page=False)
    debrief.wait_for_timeout(3200)
    scroll_close = debrief.locator(".debrief-v3").evaluate("el => el.scrollTop")
    close_reveals = debrief.locator("#debrief-close [data-reveal].is-visible").count()
    close_text_motion = debrief.locator("#debrief-close .close-beat-one").evaluate("el => ({name: getComputedStyle(el).animationName, duration: getComputedStyle(el).animationDuration})")
    close_mascot_motion = debrief.locator("#debrief-close .debrief-close-mascot").evaluate("el => getComputedStyle(el).animationName")
    close_lock_visible = float(debrief.locator("#debrief-close .close-lock").evaluate("el => getComputedStyle(el).opacity")) > 0.9
    pedagogical_steps = debrief.locator("#debrief-close .debrief-next li").all_text_contents()
    debrief.screenshot(path=str(out / "debrief-close-settled.png"), full_page=False)
    debrief.close()

    medium = browser.new_page(viewport={"width": 1366, "height": 768}, device_scale_factor=1)
    medium.goto("http://127.0.0.1:4173/?qa=debrief", wait_until="domcontentloaded")
    medium.locator(".debrief-result-sequence").wait_for()
    medium.wait_for_timeout(5200)
    medium.screenshot(path=str(out / "debrief-1366-settled.png"), full_page=False)
    medium_overflow = medium.locator(".debrief-v3").evaluate("el => el.scrollWidth <= el.clientWidth")
    medium.close()

    debrief_mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    debrief_mobile.goto("http://127.0.0.1:4173/?qa=debrief", wait_until="domcontentloaded")
    debrief_mobile.locator(".debrief-result-sequence").wait_for()
    debrief_mobile.wait_for_timeout(5200)
    debrief_mobile.screenshot(path=str(out / "debrief-mobile-settled.png"), full_page=False)
    debrief_mobile_overflow = debrief_mobile.locator(".debrief-v3").evaluate("el => el.scrollWidth <= el.clientWidth")
    debrief_mobile.close()

    reduced_context = browser.new_context(viewport={"width": 1366, "height": 768}, reduced_motion="reduce")
    reduced = reduced_context.new_page()
    reduced.goto("http://127.0.0.1:4173/?qa=debrief", wait_until="domcontentloaded")
    reduced.locator(".debrief-result-sequence").wait_for()
    reduced.wait_for_timeout(250)
    reduced_lock_visible = float(reduced.locator(".result-lock").evaluate("el => getComputedStyle(el).opacity")) > 0.9
    reduced_beat_hidden = reduced.locator(".result-beat-one").evaluate("el => getComputedStyle(el).display") == "none"
    reduced_context.close()

    assert intro_text_separated, "Desktop intro kicker overlaps the main title"
    assert mobile_text_separated, "Mobile intro kicker overlaps the main title"
    assert debrief_has_vertical_scroll, "Debrief must contain a deliberate multi-screen scroll story"
    assert result_motion == {"name": "result-beat-one", "duration": "4.9s"}, f"Result typography timing changed: {result_motion}"
    assert result_lock_visible, "Result keyword bar must remain visible after the kinetic sequence"
    assert scroll_cues >= 2, "Debrief needs visible scroll guidance between chapters"
    assert scroll_role > scroll_start + 300, "First scroll guide did not move to the role chapter"
    assert scroll_close > scroll_role + 300, "Second scroll guide did not move to the closing chapter"
    assert role_reveals >= 3, f"Role chapter reveal animation did not activate: {role_reveals}"
    assert close_reveals >= 3, f"Closing chapter reveal animation did not activate: {close_reveals}"
    assert "ppt-intro-title" in intro_title_motion, f"Opening title motion missing: {intro_title_motion}"
    assert intro_arena_motion == "ppt-intro-arena", f"Opening arena motion missing: {intro_arena_motion}"
    assert role_image_motion == "ppt-image-left", f"Role image motion missing: {role_image_motion}"
    assert close_text_motion == {"name": "close-beat-one", "duration": "5.8s"}, f"Closing typography timing changed: {close_text_motion}"
    assert close_lock_visible, "Closing pedagogical message must remain visible after animation"
    assert pedagogical_steps == ["Mở mục 1.2", "Mở bản sao phiếu", "Ghi câu trả lời", "Nộp bài"], pedagogical_steps
    assert close_mascot_motion == "ppt-mascot-celebrate", f"Closing mascot motion missing: {close_mascot_motion}"
    assert medium_overflow and debrief_mobile_overflow, "Debrief has horizontal overflow at a required viewport"
    assert reduced_lock_visible and reduced_beat_hidden, "Reduced motion must show the stable result immediately"
    assert portal_duration == "3.05s", f"Opening portal morph was shortened or disabled: {portal_duration}"
    assert portal_visibility == "visible", f"Opening portal morph is not visible after replay: {portal_visibility}"

    page.bring_to_front()
    page.get_by_role("button", name="Chơi bằng chuột").click()
    # Qua hiệu ứng chuyển màn + đếm ngược, rồi để nhiều nhiệm vụ rơi đủ xa
    # nhằm kiểm tra trực quan nhịp rơi, mật độ và khả năng đọc nhãn.
    page.wait_for_timeout(9000)
    frame_stats = page.evaluate("""
        () => new Promise((resolve) => {
            const deltas = [];
            let previous = performance.now();
            const started = previous;
            const sample = (now) => {
                deltas.push(now - previous);
                previous = now;
                if (now - started < 1800) {
                    requestAnimationFrame(sample);
                    return;
                }
                const sorted = deltas.slice(1).sort((a, b) => a - b);
                const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
                resolve({
                    samples: sorted.length,
                    average_ms: Number(average.toFixed(2)),
                    p95_ms: Number(sorted[Math.floor(sorted.length * .95)].toFixed(2)),
                    max_ms: Number(sorted[sorted.length - 1].toFixed(2)),
                });
            };
            requestAnimationFrame(sample);
        })
    """)
    assert frame_stats["samples"] >= 30, f"Too few animation samples: {frame_stats}"
    page.screenshot(path=str(out / "game-live.png"), full_page=False)
    canvas = page.locator("canvas").count()
    hud = page.locator(".game-hud").count()
    canvas_density = page.locator("canvas").evaluate("el => ({x: Number((el.width / el.clientWidth).toFixed(2)), y: Number((el.height / el.clientHeight).toFixed(2))})")
    assert canvas_density["x"] >= 1 and canvas_density["y"] >= 1, f"Canvas is still being upscaled and will look blurry: {canvas_density}"
    print({
        "intro_animation": motion,
        "intro_presentation_motion": [intro_title_motion, intro_arena_motion],
        "intro_portal_morph": [portal_duration, portal_visibility],
        "animated_tasks": orbs,
        "desktop_no_horizontal_overflow": no_horizontal_overflow,
        "desktop_no_vertical_overflow": no_vertical_overflow,
        "intro_text_separated": intro_text_separated,
        "mobile_no_horizontal_overflow": mobile_overflow,
        "mobile_text_separated": mobile_text_separated,
        "debrief_no_horizontal_overflow": debrief_no_horizontal_overflow,
        "debrief_has_three_screen_scroll": debrief_has_vertical_scroll,
        "debrief_missions": debrief_missions,
        "scroll_cues": scroll_cues,
        "scroll_positions": [scroll_start, scroll_role, scroll_close],
        "role_reveals": role_reveals,
        "close_reveals": close_reveals,
        "debrief_presentation_motion": [role_image_motion, close_mascot_motion],
        "debrief_kinetic_motion": [result_motion, close_text_motion],
        "debrief_persistent_messages": [result_lock_visible, close_lock_visible],
        "debrief_responsive_overflow": [medium_overflow, debrief_mobile_overflow],
        "debrief_reduced_motion": [reduced_lock_visible, reduced_beat_hidden],
        "fall_speed_scale": fall_scale,
        "frame_stats": frame_stats,
        "selected_modes": selected_modes,
        "canvas": canvas,
        "canvas_density": canvas_density,
        "hud": hud,
        "errors": errors,
        "failed_resources": failed_resources,
        "failed_requests": failed_requests,
    })
    browser.close()
