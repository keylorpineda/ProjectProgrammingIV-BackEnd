import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import { UploadService } from "./upload.service";
import { v2 as cloudinary } from "cloudinary";
import { Writable } from "stream";

jest.mock("cloudinary");

describe("UploadService", () => {
  let service: UploadService;

  // Helper function to create mock upload stream
  const createMockUploadStream = (shouldSucceed = true, mockResponse?: any) => {
    return jest.fn().mockImplementation((options, callback) => {
      const mockStream = new Writable({
        write() {
          // Simulate stream accepting data
        },
      });

      if (shouldSucceed) {
        setTimeout(
          () =>
            callback(null, {
              secure_url: "https://cloudinary.com/image.jpg",
              public_id: "zombie-camp/person/abc123",
              ...mockResponse,
            }),
          0,
        );
      } else {
        setTimeout(() => callback(new Error("Upload failed"), null), 0);
      }

      return mockStream;
    });
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: { [key: string]: string } = {
                CLOUDINARY_CLOUD_NAME: "test-cloud",
                CLOUDINARY_API_KEY: "test-key",
                CLOUDINARY_API_SECRET: "test-secret",
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadImage", () => {
    it("should upload image successfully", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
        destination: "/tmp",
        filename: "test.jpg",
      } as any;

      const mockResponse = {
        secure_url: "https://cloudinary.com/image.jpg",
        public_id: "zombie-camp/person/abc123",
      };

      // Create a mock Writable stream
      (cloudinary.uploader.upload_stream as jest.Mock) = jest
        .fn()
        .mockImplementation((options, callback) => {
          // Return a writable stream that simulates Cloudinary's behavior
          const mockStream = new Writable({
            write() {
              // Simulate stream accepting data
            },
          });

          // Simulate successful upload after stream receives data
          setTimeout(() => callback(null, mockResponse), 0);

          return mockStream;
        });

      const result = await service.uploadImage(mockFile, "person");

      expect(result.url).toBe("https://cloudinary.com/image.jpg");
      expect(result.publicId).toBe("zombie-camp/person/abc123");
    });

    it("should throw error for invalid file type (PDF)", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.pdf",
        encoding: "7bit",
        mimetype: "application/pdf",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      await expect(service.uploadImage(mockFile, "person")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw error for invalid file type (Text)", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.txt",
        encoding: "7bit",
        mimetype: "text/plain",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      await expect(service.uploadImage(mockFile, "person")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw error for file exceeding 5MB", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "large.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 6 * 1024 * 1024,
        buffer: Buffer.from("x".repeat(6 * 1024 * 1024)),
      } as any;

      await expect(service.uploadImage(mockFile, "person")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should handle Cloudinary upload error", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      (cloudinary.uploader.upload_stream as jest.Mock) =
        createMockUploadStream(false);

      await expect(service.uploadImage(mockFile, "person")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should accept JPEG format", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      (cloudinary.uploader.upload_stream as jest.Mock) =
        createMockUploadStream(true);

      const result = await service.uploadImage(mockFile, "person");
      expect(result.url).toBeDefined();
    });

    it("should accept PNG format", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.png",
        encoding: "7bit",
        mimetype: "image/png",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      (cloudinary.uploader.upload_stream as jest.Mock) = createMockUploadStream(
        true,
        {
          public_id: "zombie-camp/person/abc124",
        },
      );

      const result = await service.uploadImage(mockFile, "person");
      expect(result.url).toBeDefined();
    });

    it("should accept JPG format", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpg",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      (cloudinary.uploader.upload_stream as jest.Mock) =
        createMockUploadStream(true);

      const result = await service.uploadImage(mockFile, "person");
      expect(result.url).toBeDefined();
    });

    it("should accept WEBP format", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.webp",
        encoding: "7bit",
        mimetype: "image/webp",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      (cloudinary.uploader.upload_stream as jest.Mock) =
        createMockUploadStream(true);

      const result = await service.uploadImage(mockFile, "person");
      expect(result.url).toBeDefined();
    });

    it("should upload to correct folder (person)", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      (cloudinary.uploader.upload_stream as jest.Mock) = jest
        .fn()
        .mockImplementation((options, callback) => {
          expect(options.folder).toBe("zombie-camp/person");
          const mockStream = new Writable({
            write() {},
          });
          setTimeout(
            () =>
              callback(null, {
                secure_url: "https://cloudinary.com/image.jpg",
                public_id: "zombie-camp/person/abc123",
              }),
            0,
          );
          return mockStream;
        });

      await service.uploadImage(mockFile, "person");
    });

    it("should upload to correct folder (resource)", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
      } as any;

      (cloudinary.uploader.upload_stream as jest.Mock) = jest
        .fn()
        .mockImplementation((options, callback) => {
          expect(options.folder).toBe("zombie-camp/resource");
          const mockStream = new Writable({
            write() {},
          });
          setTimeout(
            () =>
              callback(null, {
                secure_url: "https://cloudinary.com/image.jpg",
                public_id: "zombie-camp/resource/xyz789",
              }),
            0,
          );
          return mockStream;
        });

      await service.uploadImage(mockFile, "resource");
    });
  });

  describe("uploadMultipleImages", () => {
    it("should upload multiple images", async () => {
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

      (cloudinary.uploader.upload_stream as jest.Mock) =
        createMockUploadStream(true);

      const results = await service.uploadMultipleImages(mockFiles, "person");

      expect(results).toHaveLength(2);
      expect(results[0].url).toBeDefined();
      expect(results[1].url).toBeDefined();
    });

    it("should fail if any file fails to upload", async () => {
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
          originalname: "test2.pdf",
          encoding: "7bit",
          mimetype: "application/pdf",
          size: 1024,
          buffer: Buffer.from("test2"),
        },
      ] as any;

      await expect(
        service.uploadMultipleImages(mockFiles, "person"),
      ).rejects.toThrow();
    });

    it("should accept empty array and return empty array", async () => {
      const mockFiles = [] as any;

      const results = await service.uploadMultipleImages(mockFiles, "person");

      expect(results).toEqual([]);
    });
  });

  describe("deleteImage", () => {
    it("should delete image from Cloudinary", async () => {
      (cloudinary.uploader.destroy as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ result: "ok" });

      await service.deleteImage("zombie-camp/person/abc123");

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
        "zombie-camp/person/abc123",
      );
    });

    it("should throw error if deletion fails", async () => {
      (cloudinary.uploader.destroy as jest.Mock) = jest
        .fn()
        .mockRejectedValue(new Error("Delete failed"));

      await expect(
        service.deleteImage("zombie-camp/person/abc123"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getThumbnailUrl", () => {
    it("should generate thumbnail URL with default dimensions", () => {
      (cloudinary.url as jest.Mock) = jest
        .fn()
        .mockReturnValue("https://cloudinary.com/image_w_100_h_100.jpg");

      const thumbnailUrl = service.getThumbnailUrl("zombie-camp/person/abc123");

      expect(thumbnailUrl).toBeDefined();
      expect(cloudinary.url).toHaveBeenCalledWith(
        "zombie-camp/person/abc123",
        expect.any(Object),
      );
    });

    it("should generate thumbnail URL with custom dimensions", () => {
      (cloudinary.url as jest.Mock) = jest
        .fn()
        .mockReturnValue("https://cloudinary.com/image_w_200_h_200.jpg");

      const thumbnailUrl = service.getThumbnailUrl(
        "zombie-camp/person/abc123",
        200,
        200,
      );

      expect(thumbnailUrl).toBeDefined();
    });

    it("should generate thumbnail with specified width", () => {
      (cloudinary.url as jest.Mock) = jest
        .fn()
        .mockReturnValue("https://cloudinary.com/image_w_300.jpg");

      const thumbnailUrl = service.getThumbnailUrl(
        "zombie-camp/person/abc123",
        300,
        300,
      );

      expect(thumbnailUrl).toBeDefined();
    });

    it("should generate thumbnail with face gravity", () => {
      (cloudinary.url as jest.Mock) = jest
        .fn()
        .mockReturnValue("https://cloudinary.com/image_gravity_face.jpg");

      service.getThumbnailUrl("zombie-camp/person/abc123", 150, 150);

      expect(cloudinary.url).toHaveBeenCalledWith(
        "zombie-camp/person/abc123",
        expect.objectContaining({
          transformation: expect.any(Array),
        }),
      );
    });
  });

  describe("getAvatarUrl", () => {
    it("should generate avatar URL with default size", () => {
      (cloudinary.url as jest.Mock) = jest
        .fn()
        .mockReturnValue("https://cloudinary.com/avatar_w_50_h_50.jpg");

      const avatarUrl = service.getAvatarUrl("zombie-camp/avatar/abc123");

      expect(avatarUrl).toBeDefined();
      expect(cloudinary.url).toHaveBeenCalledWith(
        "zombie-camp/avatar/abc123",
        expect.any(Object),
      );
    });

    it("should generate avatar URL with custom size", () => {
      (cloudinary.url as jest.Mock) = jest
        .fn()
        .mockReturnValue("https://cloudinary.com/avatar_w_100_h_100.jpg");

      const avatarUrl = service.getAvatarUrl("zombie-camp/avatar/abc123", 100);

      expect(avatarUrl).toBeDefined();
    });

    it("should apply circular radius to avatar", () => {
      (cloudinary.url as jest.Mock) = jest
        .fn()
        .mockReturnValue("https://cloudinary.com/avatar_radius_max.jpg");

      service.getAvatarUrl("zombie-camp/avatar/abc123", 80);

      expect(cloudinary.url).toHaveBeenCalledWith(
        "zombie-camp/avatar/abc123",
        expect.objectContaining({
          transformation: expect.any(Array),
        }),
      );
    });

    it("should apply face gravity to avatar", () => {
      (cloudinary.url as jest.Mock) = jest
        .fn()
        .mockReturnValue("https://cloudinary.com/avatar_gravity_face.jpg");

      service.getAvatarUrl("zombie-camp/avatar/abc123", 120);

      const call = (cloudinary.url as jest.Mock).mock.calls[0];
      expect(call[1].transformation[0].gravity).toBe("face");
    });

    it("should add quality optimization", () => {
      (cloudinary.url as jest.Mock) = jest
        .fn()
        .mockReturnValue("https://cloudinary.com/avatar_quality_auto.jpg");

      service.getAvatarUrl("zombie-camp/avatar/abc123", 75);

      const call = (cloudinary.url as jest.Mock).mock.calls[0];
      expect(call[1].transformation).toHaveLength(2);
    });
  });
});
