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
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { SwitchCampDto } from "./dto/switch-camp.dto";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/v1/auth",
};

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Iniciar sesión con credenciales" })
  async login(
    @Body() dto: LoginDto,
    @Ip() ipAddress: string,
    @Headers("user-agent") userAgent?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.authService.login(dto, ipAddress, userAgent);

    res?.cookie("refresh_token", result.refresh_token, REFRESH_COOKIE_OPTIONS);

    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post("logout")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Cerrar sesión del usuario actual" })
  async logout(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req as any).cookies?.refresh_token;
    await this.authService.logout(user.userId, refreshToken);
    res.clearCookie("refresh_token", { path: "/api/v1/auth" });
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Renovar access token usando refresh token" })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req as any).cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException("No refresh token provided");
    }

    const result = await this.authService.refresh(refreshToken);

    res.cookie("refresh_token", result.refresh_token, REFRESH_COOKIE_OPTIONS);

    return { access_token: result.access_token };
  }

  @Get("session-status")
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Verificar estado de la sesión y tiempo restante antes del auto-logout",
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
  async switchCamp(
    @CurrentUser() user: any,
    @Body() dto: SwitchCampDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.switchCamp(user.userId, dto.camp_id);

    res.cookie("refresh_token", result.refresh_token, REFRESH_COOKIE_OPTIONS);

    return {
      access_token: result.access_token,
      user: result.user,
    };
  }
}
