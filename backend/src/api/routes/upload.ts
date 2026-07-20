import { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/auth.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export async function uploadRoutes(fastify: FastifyInstance) {
  // Protect upload endpoint with authentication
  fastify.addHook("preHandler", authenticate);

  fastify.post("/upload", async (request, reply) => {
    // Verify that the request is indeed a multipart stream
    if (!request.isMultipart()) {
      return reply.status(400).send({ error: "Request is not multipart. Please send files via multipart/form-data form." });
    }

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "No file was uploaded." });
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.resolve("./data/uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      console.log(`📤 Starting file upload stream for: ${data.filename}`);

      // Generate a collision-free UUID filename and preserve extension
      const fileExt = path.extname(data.filename).toLowerCase();
      const uniqueFilename = `${crypto.randomUUID()}${fileExt}`;
      const finalDestPath = path.join(uploadsDir, uniqueFilename);

      // Stream the uploaded chunked data to the destination file
      const writeStream = fs.createWriteStream(finalDestPath);
      
      await new Promise<void>((resolve, reject) => {
        let limitTriggered = false;

        data.file.pipe(writeStream);
        
        data.file.on("end", () => {
          if (!limitTriggered) resolve();
        });
        
        data.file.on("limit", () => {
          limitTriggered = true;
          writeStream.destroy();
          fs.unlink(finalDestPath, () => {});
          reject(new Error("File size limit exceeded (Max 100MB)."));
        });

        data.file.on("error", (err) => {
          writeStream.destroy();
          fs.unlink(finalDestPath, () => {});
          reject(err);
        });

        data.file.on("close", () => {
          setTimeout(() => {
            if (!limitTriggered && !writeStream.writableEnded) {
              writeStream.destroy();
              fs.unlink(finalDestPath, () => {});
              reject(new Error("Upload stream closed prematurely."));
            }
          }, 500);
        });
      });

      // Construct a relative path that can be easily resolved on the server
      const relativePath = path.join("data", "uploads", uniqueFilename);
      console.log(`📥 Upload Success! Saved file from client to: ${finalDestPath}`);

      return reply.send({ filePath: relativePath });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message || "File upload stream failed on the server." });
    }
  });
}
