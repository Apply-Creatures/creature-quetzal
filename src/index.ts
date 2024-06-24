import * as http from "node:http";
import * as formidable from "formidable";
import type { Files } from "formidable";
import { spawn } from "node:child_process";
import { createReadStream, rm } from "fs-extra";
import * as path from "node:path";
import * as fs from "node:fs";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

const setCORSHeaders = (res: http.ServerResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Accept");
};

const denoise = (
  file: formidable.File,
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  return new Promise<void>((resolve, reject) => {
    // ../rnnoise/examples/rnnoise_demo /tmp/ed16a39c1183c007e16447401.pcm /tmp/cleaned.pcm
    console.log(`about to denoise: ${file.filepath}.pcm`);
    const rnnoiseProcess = spawn("../rnnoise/examples/rnnoise_demo", [
      `${file.filepath}.pcm`,
      `${file.filepath}.denoised.pcm`,
    ]);

    rnnoiseProcess.on("exit", (code) => {
      if (code === 0) {
        console.log("Desnoised successfully");
        resolve();
      } else {
        console.error("Error during denoising conversion:", code);
        reject("Denoising error");
      }
    });
  });
};

const convertToMP3 = (
  file: formidable.File,
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  return new Promise<void>((resolve, reject) => {
    const ffmpegProcess = spawn("ffmpeg", [
      "-f",
      "s16le",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-i",
      `${file.filepath}.denoised.pcm`, // input file
      `${file.filepath}.denoised.mp3`, // output filename
    ]);

    //ffmpeg -f s16le -ar 44100 -ac 2 -i input.pcm output.mp3


    ffmpegProcess.on("exit", (code) => {
      if (code === 0) {
        console.log("FFmpeg conversion to MP3 successful");
        resolve();
      } else {
        console.error("Error during FFmpeg conversion to MP3:", code);
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("Error during conversion");
        reject("Error during FFmpeg conversion to MP3");
      }

      ffmpegProcess.stderr.on('data', (data) => {
        console.error('FFmpeg error:', data.toString());
      });
    });
  });
};

const convertToPCM = (
  file: formidable.File,
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  return new Promise<void>((resolve, reject) => {
    const ffmpegProcess = spawn("ffmpeg", [
      "-i",
      file.filepath,
      "-acodec",
      "pcm_s16le", 
      "-ar",
      "44100", 
      "-ac",
      "2", 
      "-f",
      "s16le", 
      `${file.filepath}.pcm`, 
    ]);

    ffmpegProcess.on("exit", (code) => {
      if (code === 0) {
        console.log("FFmpeg conversion to PCM successful");
        resolve();
      } else {
        console.error("Error during FFmpeg conversion to PCM:", code);
        reject("Error during FFmpeg conversion to PCM");
      }
    });
  });
};

const handleUpload = (req: http.IncomingMessage, res: http.ServerResponse) => {
  setCORSHeaders(res);
  
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const options: formidable.Options = {
    uploadDir: "/tmp/",
    maxFileSize: MAX_FILE_SIZE,
  };
  const form = new formidable.IncomingForm(options);
  const files: (string | formidable.File)[] = [];
  const fields: (string | string)[] = [];

  form
    .on("field", (field: string, value: string) => {
      console.log(field, value);
      fields.push(value);
    })
    .on("fileBegin", (_: string, file: formidable.File) => {
      file.newFilename = "coco.txt";
    })
    .on("file", (_: string, file: formidable.File) => {
      console.log(`File saved to ${file.filepath}`);
      files.push(file);
      // Chain the promises for sequential execution:
      convertToPCM(file, req, res)
        .then(() => denoise(file, req, res))
        .then(() => convertToMP3(file, req, res))
        .then(() => {
          const filename = file.filepath.split("/").pop() || "denoised.mp3"; // Fallback to 'denoised.mp3' if no filename
          const filePath = `${file.filepath}.denoised.mp3`;
          console.log("Downloading");
          const fileStream = createReadStream(filePath);
          res.setHeader(
            "Content-disposition",
            `attachment; filename="${filename}.mp3"`
          );

          res.setHeader("Content-type", "audio/mpeg");
          fileStream.pipe(res);
        })
        .then(() => {
          try {
            const tmp = "/tmp/";
            fs.promises.readdir(tmp).then(async (files) => {
              for (const file of files) {
                const fullPath = path.join(tmp, file);
                const stats = await fs.promises.stat(fullPath);
                if (stats.isFile()) {
                 // await rm(fullPath);
                } else if (stats.isDirectory()) {
                 // await rm(fullPath, { recursive: true });
                }
              }
            });
            console.log("Temporary files cleaned up.");
          } catch (error) {
            console.error("Error cleaning up temporary files:", error);
          }
        })
        .catch((error) => {
          console.error("Error during processing:", error);
          res.writeHead(500, { "content-type": "text/plain" });
          res.end("Error during processing");
        });
    })
    .on("error", (err) => {
      if (err.message.includes("maxFileSize")) {
        console.error("File size limit exceeded");
        res.writeHead(413, { "content-type": "text/plain" });
        res.end("File too large");
        return;
      }
    });

  form.parse(req, (err, fields, files: Files) => {
    if (err) {
      console.error(err);
      res.writeHead(500, { "content-type": "text/plain" });
      res.write("received upload\n\n");
      res.end("but NOT ok");
      return;
    }
  });
};

const serveStaticFile = (req: http.IncomingMessage, res: http.ServerResponse, filePath: string, contentType: string) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    }
  });
};

const serveStaticFiles = (req: http.IncomingMessage, res: http.ServerResponse) => {
  const url = req.url || "";
  const filePath = path.join(__dirname, "", url);

  // Define the allowed file extensions and their corresponding content types
  const contentTypes: { [key: string]: string } = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".png": "image/png",
  };

  // Check if the requested file exists
  fs.stat(filePath, (err, stats) => {
    if (err) {
      console.error("Error checking file existence:", err);
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    } else {
      // Check if it's a file
      if (stats.isFile()) {
        // Determine the content type based on the file extension
        const ext = path.extname(filePath);
        const contentType = contentTypes[ext] || "application/octet-stream";
        // Serve the static file
        serveStaticFile(req, res, filePath, contentType);
      } else {
        // If it's not a file, return a 404 response
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    }
  });
};

const server: http.Server = http.createServer(
  (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.url === "/") {
      const filePath = path.join(__dirname, "upload.html"); // Get the path to the HTML file
      createReadStream(filePath).pipe(res); // Pipe the HTML file content to the response
    } else if (req.url === "/upload") {
      handleUpload(req, res);
    } else if (req.url.includes("/api/")) {
      // Serve static files
      serveStaticFiles(req, res);
    } else {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("404");
    }
  }
);

const PORT = 3002;
server.listen(PORT);

console.log(`listening on http://localhost:${PORT}/`);