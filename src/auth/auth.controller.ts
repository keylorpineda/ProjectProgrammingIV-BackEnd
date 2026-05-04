import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { SwitchCampDto } from "./dto/switch-camp.dto";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Iniciar sesi�n con credenciales" })
  async login(
    @Body() dto: LoginDto,
    @Ip() ipAddress: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Post("logout")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Cerrar sesi�n del usuario actual" })
  async logout(
    @CurrentUser() user: any,
    @Body() body?: { refresh_token?: string },
  ) {
    await this.authService.logout(user.userId, body?.refresh_token);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Renovar access token usando refresh token" })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Get("session-status")
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Verificar estado de la sesi�n y tiempo restante antes del auto-logout",
  })
  async checkSessionStatus(@CurrentUser() user: any) {
    return this.authService.checkSessionStatus(user.userId);
  }

  @Patch("switch-camp")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Cambiar campamento activo del usuario autenticado",
  })
  async switchCamp(@CurrentUser() user: any, @Body() dto: SwitchCampDto) {
    return this.authService.switchCamp(user.userId, dto.camp_id);
  }
}
