import express from 'express';
import ytdl from 'ytdl-core';
import fs from 'fs';
const app = express();
const port = process.env.PORT || 3000;

// Serve HTML page with form for entering YouTube URL and options
app.get('/', (req, res) => {
    res.send(`
        <html>
            <title>YT Media Extractor</title>
            <body>
                <h1>YT Media Extractor</h1>
                <form action="/validate" method="get">
                    <label for="url">YouTube URL:</label><br>
                    <input type="text" id="url" name="url" required><br><br>
                    <button type="submit">Download</button>
                </form>
            </body>
        </html>
    `);
});

// Check for the media type and quality
app.get('/validate', async (req, res) => {
    const url = req.query.url;
    const contentType = req.query.type; // "audio" or "video"

    // Check if the URL is valid
    if (!ytdl.validateURL(url)) {
        res.status(400).send('Invalid YouTube URL');
        return;
    }

    try {
        const info = await ytdl.getInfo(url);
        let formatOptionsHTML = ''; // Initialize empty format options HTML

        // Filter formats for video content
        const videoFormats = info.formats.filter(format => format.hasVideo && format.hasAudio);

        // Generate HTML for video format options
        videoFormats.forEach((format, index) => {
            formatOptionsHTML += `<option value="${index}">${format.qualityLabel || format.audioQuality}</option>`;
        });

        // Send HTML response with the form
        res.send(`
            <html>
                <title>YT Media Extractor</title>
                <body>
                    <h1>Available Formats</h1>
                    <form action="/download" method="get">
                        <label for="url">YouTube URL:</label><br>
                        <input type="text" id="url" name="url" value="${url}" readonly><br><br>
                        <input type="radio" id="audio" name="type" value="audio" ${contentType === 'audio' ? 'checked' : ''} onclick="hideFormatDropdown()">
                        <label for="audio">Audio</label>
                        <input type="radio" id="video" name="type" value="video" ${contentType === 'video' ? 'checked' : ''} onclick="showFormatDropdown()">
                        <label for="video">Video</label><br><br>
                        <div id="formatDropdown" style="display: ${contentType === 'video' ? 'block' : 'none'}">
                            <label for="format">Select Format:</label><br>
                            <select id="format" name="format" required>
                                ${formatOptionsHTML}
                            </select><br><br>
                        </div>
                        <button type="submit">Download</button>
                    </form>
                    <script>
                        function showFormatDropdown() {
                            document.getElementById('formatDropdown').style.display = 'block';
                        }
                        
                        function hideFormatDropdown() {
                            document.getElementById('formatDropdown').style.display = 'none';
                        }
                    </script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Error fetching video information:', error);
        res.status(500).send('Error fetching video information');
    }
});


// Download audio or video based on user input
app.get('/download', async (req, res) => {
    const url = req.query.url;
    const isVideo = req.query.type === 'video'; // Check if the requested media type is video
    const formatIndex = parseInt(req.query.format); // Get the index of the selected format

    console.log(req.query)

    // Check if the URL is valid
    if (!ytdl.validateURL(url)) {
        res.status(400).send('Invalid YouTube URL');
        return;
    }

    try {
        // Get video info
        const info = await ytdl.getInfo(url);

        // Extract video title
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');

        // Filter formats based on user preferences
        const formats = info.formats.filter(format =>
            isVideo ? format.hasVideo && format.hasAudio : format.hasAudio && !format.hasVideo
        );

        // console.log('formats', formats.length, formatIndex, formats)

        // Check if the format index is valid
        if (formatIndex < 0 || formatIndex >= formats.length) {
            throw new Error('Invalid format index');
        }

        // Get the selected format
        const selectedFormat = formats[formatIndex];

        // console.log('selectedFormat', selectedFormat)

        // Start downloading
        const stream = ytdl.downloadFromInfo(info, {
            quality: selectedFormat.itag
        });

        // Define the output file name based on media type
        const fileName = `${title}${isVideo ? `(${selectedFormat.qualityLabel}).mp4` : '.mp3'}`;

        // Create a write stream to save the downloaded content
        const fileStream = fs.createWriteStream(fileName);

        // Pipe the downloaded content to the file stream
        stream.pipe(fileStream);

        // Event listener for completion
        stream.on('end', () => {
            console.log(`Download completed. Saved as ${fileName}`);
            res.download(fileName, (err) => {
                if (err) {
                    console.error('Error downloading file:', err);
                }
                fs.unlinkSync(fileName); // Delete the file after download
            });
        });

        // Event listener for errors
        stream.on('error', (err) => {
            console.error('Error downloading content:', err);
            res.status(500).send('Error downloading content');
        });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).send('Error downloading content');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
