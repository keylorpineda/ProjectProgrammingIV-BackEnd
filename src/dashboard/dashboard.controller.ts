import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import {
  DashboardService,
  DashboardMetricsResponse,
  CampLeaderboardEntry,
} from "./dashboard.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("leaderboard")
  @Roles("admin", "resource_manager")
  @ApiOperation({
    summary: "Get top 10 camps by survival score",
  })
  async getCampLeaderboard(): Promise<CampLeaderboardEntry[]> {
    return this.dashboardService.getCampLeaderboard();
  }

  @Get(":campId")
  @Roles("admin", "resource_manager")
  @ApiOperation({
    summary: "Get dashboard metrics by camp and role visibility",
  })
  async getDashboardByCamp(
    @Param("campId", ParseIntPipe) campId: number,
    @CurrentUser() user: { role?: string },
  ): Promise<DashboardMetricsResponse> {
    return this.dashboardService.getMetricsByCamp(campId, user?.role ?? "");
  }
}
