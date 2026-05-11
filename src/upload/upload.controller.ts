import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Body,
  Delete,
  UseGuards,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { UploadService } from "./upload.service";
import { UploadResponseDto } from "./dto/upload-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from "@nestjs/swagger";

@ApiTags("Upload")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("person")
  @ApiOperation({
    summary: "Subir foto de persona o tarjeta de identificacion",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor("file"))
  async uploadPersonImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException("No se proporciona ningun archivo");
    }

    const result = await this.uploadService.uploadImage(file, "person");
    const thumbnailUrl = this.uploadService.getThumbnailUrl(
      result.publicId,
      200,
      200,
    );

    return {
      url: result.url,
      publicId: result.publicId,
      thumbnailUrl,
    };
  }

  @Post("resource")
  @ApiOperation({ summary: "Subir imagen de recurso" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor("file"))
  async uploadResourceImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException("No se proporciona ningun archivo");
    }

    const result = await this.uploadService.uploadImage(file, "resource");
    const thumbnailUrl = this.uploadService.getThumbnailUrl(
      result.publicId,
      150,
      150,
    );

    return {
      url: result.url,
      publicId: result.publicId,
      thumbnailUrl,
    };
  }

  @Post("camp")
  @ApiOperation({ summary: "Subir logo o imagen de campamento" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor("file"))
  async uploadCampImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException("No se proporciona ningun archivo");
    }

    const result = await this.uploadService.uploadImage(file, "camp");
    const thumbnailUrl = this.uploadService.getThumbnailUrl(
      result.publicId,
      300,
      200,
    );

    return {
      url: result.url,
      publicId: result.publicId,
      thumbnailUrl,
    };
  }

  @Post("avatar")
  @ApiOperation({ summary: "Subir avatar de usuario" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor("file"))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException("No se proporciona ningun archivo");
    }

    const result = await this.uploadService.uploadImage(file, "avatar");
    const avatarUrl = this.uploadService.getAvatarUrl(result.publicId, 100);

    return {
      url: result.url,
      publicId: result.publicId,
      thumbnailUrl: avatarUrl,
    };
  }

  @Post("badge")
  @ApiOperation({
    summary: "Subir imagen de badge/logro/medalla (asset generico)",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor("file"))
  async uploadBadge(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException("No se proporciona ningun archivo");
    }

    const result = await this.uploadService.uploadImage(file, "badge");

    return {
      url: result.url,
      publicId: result.publicId,
      thumbnailUrl: result.url, // Assets no necesitan thumbnail por defecto
    };
  }

  @Post("multiple")
  @ApiOperation({
    summary: "Subir multiples imagenes (ej: evidencia de exploraciones)",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: {
            type: "string",
            format: "binary",
          },
        },
        folder: {
          type: "string",
          enum: ["person", "resource", "camp", "badge", "avatar"],
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor("files", 10)) // M�ximo 10 archivos
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body("folder") folder: "person" | "resource" | "camp" | "badge" | "avatar",
  ): Promise<UploadResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException("No se proporcionaron archivos");
    }

    if (!folder) {
      throw new BadRequestException("Debe especificar la carpeta destino");
    }

    const results = await this.uploadService.uploadMultipleImages(
      files,
      folder,
    );

    return results.map((result) => ({
      url: result.url,
      publicId: result.publicId,
      thumbnailUrl: this.uploadService.getThumbnailUrl(result.publicId),
    }));
  }

  @Delete("delete")
  @ApiOperation({ summary: "Eliminar imagen desde Cloudinary" })
  async deleteImage(
    @Body("publicId") publicId: string,
  ): Promise<{ message: string }> {
    if (!publicId) {
      throw new BadRequestException(
        "Debe proporcionar el publicId de la imagen",
      );
    }

    await this.uploadService.deleteImage(publicId);

    return { message: "Imagen eliminada exitosamente" };
  }
}
