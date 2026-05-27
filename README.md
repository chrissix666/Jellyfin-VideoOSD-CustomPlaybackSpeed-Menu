# Jellyfin VideoOSD Custom Playback Speeds

!!BEFORE USE, CONFIG THE SPEEDS IN THE .js TO YOUR OWN NEEDS ON TOP FIRST!!

Tested on & Requirements: Windows 11, Chrome, Jellyfin Web (10.10.7), JavaScript Injector.<br>
Screenshot & provided in the Script are only examples.

Default/Vanilla ones are 11 speeds: 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4

Customizes the Jellyfin Web VideoOSD playback speed menu.  
**You can define your own speed list, add custom values, remove unwanted vanilla/default entries.**

Example speeds in the script & screenshot: 0.1, 0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 5, 10

<img src="Screenshot.png" width="300">

Playback speed range: `0.0625x` - `16x`  
Behavior depends on the Chrome/Chromium video engine, not on Jellyfin.

Note: During testing, values below `0.1x` could cause problems when switching back to very high speeds afterwards.<br>
Playback also became very choppy and pitchy, although audio still continued to work.<br>
For practical use, the recommended minimum speed is around `0.2x` to `0.25x`.

---

## Features

- **Add custom playback speed entries.**  
- **Remove unwanted vanilla/default speed entries.**  
- **Unlimited speed entries possible, as long as the menu fits within the video window height.**  

---

## Installation

1. If not already present, install a JavaScript injector plugin or userscript manager  
   (Jellyfin JavaScript Injector, Tampermonkey, Violentmonkey, or similar).  
2. Paste content of the .js into the injector.  
3. Adjust the `SPEEDS` array at the top of the script to your needs.  
4. Save and reload Jellyfin Web.  
5. Open a video and check the playback speed menu.

---

## Tested On

- Jellyfin Web 10.10.7
- Google Chrome
- Windows 11

---

## License

MIT
