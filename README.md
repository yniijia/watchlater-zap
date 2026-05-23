WatchLater Zap

A Chrome extension that lets you delete all videos from your YouTube Watch Later playlist with a single click.

Version: 2.6.0
Author: Tony Fiston

Features

- One-click deletion of all videos in your YouTube Watch Later playlist
- Real-time progress tracking
- Smart preview with video count and time estimate
- Two-step confirmation before clearing
- Live progress ring with ETA and cancel support
- Warm, modern UI with dark mode
- Works with large playlists (handles thousands of videos)
- Automatically detects YouTube Watch Later pages

Installation

From source (Developer Mode)

1. Clone or download this repository to your local machine
2. Open Chrome and navigate to chrome://extensions/
3. Enable Developer mode using the toggle in the top-right corner
4. Click Load unpacked and select the directory containing this extension
5. The WatchLater Zap extension should now appear in your extensions list

From Chrome Web Store

Coming soon.

Usage

1. Navigate to your YouTube Watch Later playlist: https://www.youtube.com/playlist?list=WL
2. Click the WatchLater Zap extension icon in your Chrome toolbar
3. Review the video count and estimated time, then click Clear All Videos
4. Confirm you understand the action is permanent, then click Yes, clear all
5. Watch the progress ring. You can cancel anytime until your playlist is cleared.

How It Works

The extension uses the YouTube page UI to automate the removal process:

1. It identifies each video in the playlist
2. For each video, it opens the action menu, selects Remove from Watch Later, waits for removal, and updates progress
3. It continues until all videos are removed

Notes

- The extension requires permission to access and modify content on youtube.com
- The removal process is sequential and may take time for large playlists
- YouTube's UI may change over time, which could affect the extension
- Large playlists load as you scroll. Scroll your playlist, then refresh the count in the popup

Development

The extension uses:

- Chrome Manifest V3
- Modern JavaScript (ES6+)
- Responsive CSS with dark mode
- Coral-branded icons (icons/icon.svg, run icons/generate.sh to rebuild PNGs)

To package for the Chrome Web Store:

./package.sh

License

MIT
