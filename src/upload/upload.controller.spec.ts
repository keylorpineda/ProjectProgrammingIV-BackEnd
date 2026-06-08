import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { UploadController } from "./upload.controller";
import { UploadService } from "./upload.service";

describe("UploadController", () => {
  let controller: UploadController;
  let service: UploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: {
            uploadImage: jest.fn(),
            uploadMultipleImages: jest.fn(),
            deleteImage: jest.fn(),
            getThumbnailUrl: jest.fn(),
            getAvatarUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
    service = module.get<UploadService>(UploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadPersonImage", () => {
    it("should upload person image successfully", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "person.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
        destination: "/tmp",
        filename: "person.jpg",
      } as any;

      (service.uploadImage as jest.Mock).mockResolvedValue({
        url: "https://cloudinary.com/person.jpg",
        publicId: "zombie-camp/person/abc123",
      });

      (service.getThumbnailUrl as jest.Mock).mockReturnValue(
        "https://cloudinary.com/person_thumb.jpg",
      );

      const result = await controller.uploadPersonImage(mockFile);

      expect(result.url).toBe("https://cloudinary.com/person.jpg");
      expect(result.publicId).toBe("zombie-camp/person/abc123");
      expect(result.thumbnailUrl).toBe(
        "https://cloudinary.com/person_thumb.jpg",
      );
      expect(service.uploadImage).toHaveBeenCalledWith(mockFile, "person");
      expect(service.getThumbnailUrl).toHaveBeenCalledWith(
        "zombie-camp/person/abc123",
        200,
        200,
      );
    });

    it("should throw error if no file provided", async () => {
      await expect(
        controller.uploadPersonImage(undefined as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("uploadResourceImage", () => {
    it("should upload resource image successfully", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "resource.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      (service.uploadImage as jest.Mock).mockResolvedValue({
        url: "https://cloudinary.com/resource.jpg",
        publicId: "zombie-camp/resource/xyz789",
      });

      (service.getThumbnailUrl as jest.Mock).mockReturnValue(
        "https://cloudinary.com/resource_thumb.jpg",
      );

      const result = await controller.uploadResourceImage(mockFile);

      expect(result.url).toBe("https://cloudinary.com/resource.jpg");
      expect(service.uploadImage).toHaveBeenCalledWith(mockFile, "resource");
      expect(service.getThumbnailUrl).toHaveBeenCalledWith(
        "zombie-camp/resource/xyz789",
        150,
        150,
      );
    });

    it("should throw error if no file provided", async () => {
      await expect(
        controller.uploadResourceImage(undefined as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("uploadCampImage", () => {
    it("should upload camp image successfully", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "camp.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      (service.uploadImage as jest.Mock).mockResolvedValue({
        url: "https://cloudinary.com/camp.jpg",
        publicId: "zombie-camp/camp/camp123",
      });

      (service.getThumbnailUrl as jest.Mock).mockReturnValue(
        "https://cloudinary.com/camp_thumb.jpg",
      );

      const result = await controller.uploadCampImage(mockFile);

      expect(result.url).toBe("https://cloudinary.com/camp.jpg");
      expect(service.uploadImage).toHaveBeenCalledWith(mockFile, "camp");
      expect(service.getThumbnailUrl).toHaveBeenCalledWith(
        "zombie-camp/camp/camp123",
        300,
        200,
      );
    });

    it("should throw error if no file provided", async () => {
      await expect(
        controller.uploadCampImage(undefined as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("uploadAvatar", () => {
    it("should upload avatar image successfully", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "avatar.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      (service.uploadImage as jest.Mock).mockResolvedValue({
        url: "https://cloudinary.com/avatar.jpg",
        publicId: "zombie-camp/avatar/avatar123",
      });

      (service.getAvatarUrl as jest.Mock).mockReturnValue(
        "https://cloudinary.com/avatar_circular.jpg",
      );

      const result = await controller.uploadAvatar(mockFile);

      expect(result.url).toBe("https://cloudinary.com/avatar.jpg");
      expect(service.uploadImage).toHaveBeenCalledWith(mockFile, "avatar");
      expect(service.getAvatarUrl).toHaveBeenCalledWith(
        "zombie-camp/avatar/avatar123",
        100,
      );
    });

    it("should throw error if no file provided", async () => {
      await expect(controller.uploadAvatar(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("uploadBadge", () => {
    it("should upload badge image successfully", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "badge.png",
        encoding: "7bit",
        mimetype: "image/png",
        size: 512,
        buffer: Buffer.from("test"),
      } as any;

      (service.uploadImage as jest.Mock).mockResolvedValue({
        url: "https://cloudinary.com/badge.png",
        publicId: "zombie-camp/badge/badge123",
      });

      const result = await controller.uploadBadge(mockFile);

      expect(result.url).toBe("https://cloudinary.com/badge.png");
      expect(service.uploadImage).toHaveBeenCalledWith(mockFile, "badge");
    });

    it("should throw error if no file provided", async () => {
      await expect(controller.uploadBadge(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("uploadMultiple", () => {
    it("should upload multiple files successfully", async () => {
      const mockFiles = [
        {
          fieldname: "files",
          originalname: "test1.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("test1"),
        },
        {
          fieldname: "files",
          originalname: "test2.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("test2"),
        },
      ] as any;

      (service.uploadMultipleImages as jest.Mock).mockResolvedValue([
        {
          url: "https://cloudinary.com/test1.jpg",
          publicId: "zombie-camp/person/abc123",
        },
        {
          url: "https://cloudinary.com/test2.jpg",
          publicId: "zombie-camp/person/abc124",
        },
      ]);

      (service.getThumbnailUrl as jest.Mock).mockReturnValue(
        "https://cloudinary.com/thumb.jpg",
      );

      const result = await controller.uploadMultiple(mockFiles, "person");

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe("https://cloudinary.com/test1.jpg");
      expect(service.uploadMultipleImages).toHaveBeenCalledWith(
        mockFiles,
        "person",
      );
    });

    it("should throw error if no files provided", async () => {
      await expect(
        controller.uploadMultiple([] as any, "person"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error if undefined files provided", async () => {
      await expect(
        controller.uploadMultiple(undefined as any, "person"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error if folder not specified", async () => {
      const mockFiles = [
        {
          fieldname: "files",
          originalname: "test.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("test"),
        },
      ] as any;

      await expect(
        controller.uploadMultiple(mockFiles, undefined as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should upload to resource folder", async () => {
      const mockFiles = [
        {
          fieldname: "files",
          originalname: "test.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("test"),
        },
      ] as any;

      (service.uploadMultipleImages as jest.Mock).mockResolvedValue([
        {
          url: "https://cloudinary.com/test.jpg",
          publicId: "zombie-camp/resource/abc123",
        },
      ]);

      (service.getThumbnailUrl as jest.Mock).mockReturnValue(
        "https://cloudinary.com/thumb.jpg",
      );

      await controller.uploadMultiple(mockFiles, "resource");

      expect(service.uploadMultipleImages).toHaveBeenCalledWith(
        mockFiles,
        "resource",
      );
    });

    it("should upload multiple files to camp folder", async () => {
      const mockFiles = [
        {
          fieldname: "files",
          originalname: "test1.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("test1"),
        },
        {
          fieldname: "files",
          originalname: "test2.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("test2"),
        },
        {
          fieldname: "files",
          originalname: "test3.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("test3"),
        },
      ] as any;

      (service.uploadMultipleImages as jest.Mock).mockResolvedValue([
        {
          url: "https://cloudinary.com/test1.jpg",
          publicId: "zombie-camp/camp/abc1",
        },
        {
          url: "https://cloudinary.com/test2.jpg",
          publicId: "zombie-camp/camp/abc2",
        },
        {
          url: "https://cloudinary.com/test3.jpg",
          publicId: "zombie-camp/camp/abc3",
        },
      ]);

      (service.getThumbnailUrl as jest.Mock).mockReturnValue(
        "https://cloudinary.com/thumb.jpg",
      );

      const result = await controller.uploadMultiple(mockFiles, "camp");

      expect(result).toHaveLength(3);
      expect(service.uploadMultipleImages).toHaveBeenCalledWith(
        mockFiles,
        "camp",
      );
    });
  });

  describe("deleteImage", () => {
    it("should delete image successfully", async () => {
      const publicId = "zombie-camp/person/abc123";

      (service.deleteImage as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.deleteImage(publicId);

      expect(result.message).toBe("Imagen eliminada exitosamente");
      expect(service.deleteImage).toHaveBeenCalledWith(publicId);
    });

    it("should throw error if publicId not provided", async () => {
      await expect(controller.deleteImage("")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw error if publicId is undefined", async () => {
      await expect(controller.deleteImage(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should handle service error when deleting", async () => {
      const publicId = "zombie-camp/person/abc123";

      (service.deleteImage as jest.Mock).mockRejectedValue(
        new BadRequestException("Deletion failed"),
      );

      await expect(controller.deleteImage(publicId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should delete image from different folders", async () => {
      const publicIds = [
        "zombie-camp/person/abc123",
        "zombie-camp/resource/xyz789",
        "zombie-camp/camp/camp123",
        "zombie-camp/avatar/avatar123",
        "zombie-camp/badge/badge123",
      ];

      for (const publicId of publicIds) {
        (service.deleteImage as jest.Mock).mockResolvedValue(undefined);

        const result = await controller.deleteImage(publicId);

        expect(result.message).toBe("Imagen eliminada exitosamente");
        expect(service.deleteImage).toHaveBeenCalledWith(publicId);
      }
    });
  });
});
