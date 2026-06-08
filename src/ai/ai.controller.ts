import {
  Controller,
  Get,
  Post,
  Patch,
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
  ApiBody,
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

  // ── Public ────────────────────────────────────────────────────────────────

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

  @Public()
  @Post("admissions/complete-registration")
  @ApiOperation({ summary: "Complete registration using email token" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        token: { type: "string" },
        username: { type: "string" },
        password: { type: "string" },
        email: { type: "string" },
      },
    },
  })
  async completeRegistration(
    @Body()
    body: {
      token: string;
      username: string;
      password: string;
      email: string;
    },
  ) {
    const dto = new CreateUserAccountDto();
    dto.username = body.username;
    dto.password = body.password;
    dto.email = body.email;
    dto.role_id = 2; // Default worker role
    return this.aiService.completeRegistrationFromToken(body.token, dto);
  }

  // ── Admin: pending (human review queue) ──────────────────────────────────

  @ApiBearerAuth()
  @Get("admissions/pending")
  @Roles("admin", "resource_manager", "camp_leader", "travel_manager")
  @ApiOperation({ summary: "Get pending admissions waiting for human review" })
  @ApiQuery({ name: "campId", required: false, description: "Filter by camp" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
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

  // ── Admin: auto-decided (for admin to review & archive) ───────────────────

  @ApiBearerAuth()
  @Get("admissions/auto-decided")
  @Roles("admin", "resource_manager", "camp_leader", "travel_manager")
  @ApiOperation({
    summary:
      "Get auto-accepted and auto-rejected admissions for admin visibility",
  })
  @ApiQuery({ name: "campId", required: false, description: "Filter by camp" })
  @ApiQuery({
    name: "archived",
    required: false,
    description: "true to see archived, false (default) for active",
  })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async getAutoDecidedAdmissions(
    @Query("campId") campId?: string,
    @Query("archived") archived?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.aiService.getAutoDecidedAdmissions({
      campId: campId ? parseInt(campId) : undefined,
      archived: archived === "true",
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  // ── Admin: detail ─────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @Get("admissions/:id")
  @Roles("admin", "resource_manager", "camp_leader", "travel_manager")
  @ApiOperation({ summary: "Get admission detail" })
  @ApiParam({ name: "id", description: "Admission ID" })
  async getAdmissionDetail(@Param("id", ParseIntPipe) id: number) {
    return this.aiService.getAdmissionDetail(id);
  }

  // ── Admin: manual review ──────────────────────────────────────────────────

  @ApiBearerAuth()
  @Post("admissions/:id/review")
  @Roles("admin", "camp_leader", "travel_manager", "resource_manager")
  @ApiOperation({
    summary: "Manually accept or reject a PENDING_REVIEW admission",
  })
  @ApiParam({ name: "id", description: "Admission ID" })
  async reviewAdmission(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewAdmissionDto,
    @CurrentUser() user: any,
  ) {
    return this.aiService.reviewAdmission(id, dto, user.id);
  }

  // ── Admin: archive ────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @Patch("admissions/:id/archive")
  @Roles("admin", "camp_leader", "travel_manager", "resource_manager")
  @ApiOperation({
    summary:
      "Archive a completed admission (auto or manual) so it leaves the active list",
  })
  @ApiParam({ name: "id", description: "Admission ID" })
  async archiveAdmission(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.aiService.archiveAdmission(id, user.id);
  }

  // ── Admin: create account for accepted person ─────────────────────────────

  @ApiBearerAuth()
  @Post("admissions/:id/create-account")
  @Roles("admin", "camp_leader", "travel_manager", "resource_manager")
  @ApiOperation({ summary: "Create user account for accepted person" })
  @ApiParam({ name: "id", description: "Admission ID" })
  async createUserAccount(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateUserAccountDto,
  ) {
    return this.aiService.createUserAccountForPerson(id, dto);
  }
}
