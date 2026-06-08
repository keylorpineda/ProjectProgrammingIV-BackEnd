import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { UploadApiResponse, UploadApiErrorResponse } from "cloudinary";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

@Injectable()
export class UploadService {
  constructor(private configService: ConfigService) {
    // Configurar Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get<string>("CLOUDINARY_CLOUD_NAME"),
      api_key: this.configService.get<string>("CLOUDINARY_API_KEY"),
      api_secret: this.configService.get<string>("CLOUDINARY_API_SECRET"),
    });
  }

  /**
   * Sube un archivo a Cloudinary
   * @param file - Archivo a subir
   * @param folder - Carpeta en Cloudinary (person, resource, camp, badge, avatar)
   * @returns Promise con la URL y public_id
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: "person" | "resource" | "camp" | "badge" | "avatar",
  ): Promise<{ url: string; publicId: string }> {
    // Validar tipo de archivo
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/webp",
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        "Tipo de archivo no permitido. Solo se permiten im�genes JPEG, PNG y WEBP",
      );
    }

    // Validar tama�o (m�ximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        "El archivo es demasiado grande. Tama�o m�ximo: 5MB",
      );
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `zombie-camp/${folder}`,
          transformation: [
            { quality: "auto", fetch_format: "auto" }, // Optimizaci�n autom�tica
          ],
        },
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) {
            reject(
              new BadRequestException("Error al subir imagen a Cloudinary"),
            );
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          }
        },
      );

      // Convertir buffer a stream y subir
      const stream = Readable.from(file.buffer);
      stream.pipe(uploadStream);
    });
  }

  /**
   * Sube m�ltiples archivos
   */
  async uploadMultipleImages(
    files: Express.Multer.File[],
    folder: "person" | "resource" | "camp" | "badge" | "avatar",
  ): Promise<{ url: string; publicId: string }[]> {
    const uploadPromises = files.map((file) => this.uploadImage(file, folder));
    return Promise.all(uploadPromises);
  }

  /**
   * Elimina una imagen de Cloudinary por su public_id
   */
  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new BadRequestException("Error al eliminar imagen de Cloudinary");
    }
  }

  /**
   * Genera URL de thumbnail optimizado
   */
  getThumbnailUrl(
    publicId: string,
    width: number = 100,
    height: number = 100,
  ): string {
    return cloudinary.url(publicId, {
      transformation: [
        { width, height, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
  }

  /**
   * Genera URL optimizada para avatar
   */
  getAvatarUrl(publicId: string, size: number = 50): string {
    return cloudinary.url(publicId, {
      transformation: [
        {
          width: size,
          height: size,
          crop: "fill",
          gravity: "face",
          radius: "max",
        },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
  }
}
