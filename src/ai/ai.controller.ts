import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";
import { AiService } from "./ai.service";
import { SubmitAdmissionDto } from "./dto/submit-admission.dto";
import { ReviewAdmissionDto } from "./dto/review-admission.dto";
import { CreateUserAccountDto } from "./dto/create-user-account.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("AI Admissions")
@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Public()
  @Post("admissions/submit")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Submit admission request (public)" })
  async submitAdmission(@Body() dto: SubmitAdmissionDto) {
    return this.aiService.submitAdmission(dto);
  }

  @Public()
  @Get("admissions/track/:code")
  @ApiOperation({ summary: "Track admission status (public)" })
  @ApiParam({ name: "code", description: "Tracking code" })
  async trackAdmission(@Param("code") code: string) {
    return this.aiService.trackAdmission(code);
  }

  @ApiBearerAuth()
  @Get("admissions/pending")
  @Roles("admin", "gestor_recursos")
  @ApiOperation({ summary: "Get pending admissions for review" })
  @ApiQuery({ name: "campId", required: false, description: "Filter by camp" })
  @ApiQuery({ name: "page", required: false, description: "Page number" })
  @ApiQuery({ name: "limit", required: false, description: "Items per page" })
  async getPendingAdmissions(
    @Query("campId") campId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.aiService.getPendingAdmissions(
      campId ? parseInt(campId) : undefined,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @ApiBearerAuth()
  @Get("admissions/:id")
  @Roles("admin", "gestor_recursos")
  @ApiOperation({ summary: "Get admission detail" })
  @ApiParam({ name: "id", description: "Admission ID" })
  async getAdmissionDetail(@Param("id", ParseIntPipe) id: number) {
    return this.aiService.getAdmissionDetail(id);
  }

  @ApiBearerAuth()
  @Post("admissions/:id/review")
  @Roles("admin")
  @ApiOperation({ summary: "Review and accept/reject admission" })
  @ApiParam({ name: "id", description: "Admission ID" })
  async reviewAdmission(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewAdmissionDto,
    @CurrentUser() user: any,
  ) {
    return this.aiService.reviewAdmission(id, dto, user.userId);
  }

  @ApiBearerAuth()
  @Post("admissions/:id/create-account")
  @Roles("admin")
  @ApiOperation({ summary: "Create user account for accepted person" })
  @ApiParam({ name: "id", description: "Admission ID" })
  async createUserAccount(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateUserAccountDto,
  ) {
    return this.aiService.createUserAccountForPerson(id, dto);
  }
}
