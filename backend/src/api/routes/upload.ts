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

      // Generate a collision-free UUID filename and preserve extension
      const fileExt = path.extname(data.filename).toLowerCase();
      const uniqueFilename = `${crypto.randomUUID()}${fileExt}`;
      const finalDestPath = path.join(uploadsDir, uniqueFilename);

      // Stream the uploaded chunked data to the destination file
      const writeStream = fs.createWriteStream(finalDestPath);
      
      await new Promise<void>((resolve, reject) => {
        data.file.pipe(writeStream);
        data.file.on("end", resolve);
        data.file.on("error", (err) => {
          writeStream.destroy();
          reject(err);
        });
      });

      // Construct a relative path that can be easily resolved on the server
      const relativePath = path.join("data", "uploads", uniqueFilename);
      console.log(`📥 Upload Success! Saved file from client to: ${finalDestPath}`);

      return reply.send({ filePath: relativePath });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "File upload stream failed on the server." });
    }
  });
}
