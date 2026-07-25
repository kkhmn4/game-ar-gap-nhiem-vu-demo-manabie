from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path("qa-output")
out.mkdir(exist_ok=True)
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page.on("console", lambda msg: errors.append(f"console:{msg.type}:{msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(f"page:{exc}"))
    page.goto("http://127.0.0.1:4173", wait_until="networkidle")
    page.screenshot(path=str(out / "intro-live.png"), full_page=False)
    motion = page.locator(".intro-art").evaluate("el => getComputedStyle(el).animationName")
    orbs = page.locator(".intro-orb").count()
    page.get_by_role("button", name="Chơi thử bằng chuột").click()
    page.wait_for_timeout(4200)
    page.screenshot(path=str(out / "game-live.png"), full_page=False)
    canvas = page.locator("canvas").count()
    hud = page.locator(".game-hud").count()
    print({"intro_animation": motion, "animated_orbs": orbs, "canvas": canvas, "hud": hud, "errors": errors})
    browser.close()
