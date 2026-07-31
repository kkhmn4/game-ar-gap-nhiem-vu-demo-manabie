import re
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path("qa-output")
out.mkdir(exist_ok=True)
errors = []
failed_resources = []
failed_requests = []

engine_source = Path("src/utils/engine.ts").read_text(encoding="utf-8")
fall_scale_match = re.search(r"const FALL_SPEED_SCALE = ([0-9.]+);", engine_source)
fall_scale = float(fall_scale_match.group(1)) if fall_scale_match else None
assert fall_scale == 0.35, f"Unexpected fall speed scale: {fall_scale}"
assert engine_source.count("fallSpeed:") == 4, "All three modes must define fallSpeed"
assert engine_source.count("fallSpeed: 0.") == 3, "All three modes must use the shared scale"

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
    page.goto("http://127.0.0.1:4173", wait_until="networkidle")
    page.screenshot(path=str(out / "intro-live.png"), full_page=False)
    motion = page.locator(".entry-scanline").evaluate("el => getComputedStyle(el).animationName")
    orbs = page.locator(".entry-task").count()
    no_horizontal_overflow = page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    selected_modes = []
    speed_buttons = page.locator(".entry-speed button")
    for index, mode in enumerate(("easy", "normal", "hard")):
        button = speed_buttons.nth(index)
        button.click()
        selected_modes.append((mode, button.get_attribute("aria-pressed")))

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    mobile.goto("http://127.0.0.1:4173", wait_until="networkidle")
    mobile.screenshot(path=str(out / "intro-mobile.png"), full_page=True)
    mobile_overflow = mobile.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    mobile.close()

    page.get_by_role("button", name="Chơi bằng chuột").click()
    # Qua hiệu ứng chuyển màn + đếm ngược, rồi để nhiều nhiệm vụ rơi đủ xa
    # nhằm kiểm tra trực quan nhịp rơi, mật độ và khả năng đọc nhãn.
    page.wait_for_timeout(9000)
    page.screenshot(path=str(out / "game-live.png"), full_page=False)
    canvas = page.locator("canvas").count()
    hud = page.locator(".game-hud").count()
    print({
        "intro_animation": motion,
        "animated_tasks": orbs,
        "desktop_no_horizontal_overflow": no_horizontal_overflow,
        "mobile_no_horizontal_overflow": mobile_overflow,
        "fall_speed_scale": fall_scale,
        "selected_modes": selected_modes,
        "canvas": canvas,
        "hud": hud,
        "errors": errors,
        "failed_resources": failed_resources,
        "failed_requests": failed_requests,
    })
    browser.close()
