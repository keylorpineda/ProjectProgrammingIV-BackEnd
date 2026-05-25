import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Resend } from "resend";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private resend: Resend | null = null;

  constructor(private configService: ConfigService) {
    this.init();
  }

  private async init() {
    const resendApiKey = this.configService.get<string>("RESEND_API_KEY");

    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      this.logger.log("[MailService] Usando Resend como proveedor de correo.");
      return;
    }

    // Fallback a SMTP si no hay clave de Resend
    const smtpHost = this.configService.get<string>("SMTP_HOST");
    const smtpPortStr = this.configService.get<string>("SMTP_PORT");
    const smtpPort = smtpPortStr ? parseInt(smtpPortStr, 10) : 587;
    const smtpUser = this.configService.get<string>("SMTP_USER");
    const smtpPass = this.configService.get<string>("SMTP_PASS");

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      this.logger.log(
        `[MailService] SMTP configurado: ${smtpHost}:${smtpPort} usuario=${smtpUser}`,
      );
      this.transporter.verify((err) => {
        if (err) {
          this.logger.error(
            `[MailService] SMTP verify FALLÓ — los correos no se enviarán. Error: ${String(err?.message ?? err)}`,
          );
        } else {
          this.logger.log(
            `[MailService] SMTP verify OK — servidor listo para enviar correos.`,
          );
        }
      });
    } else {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        this.logger.warn(
          `[MailService] ⚠ Usando Ethereal (emails de prueba, NO llegan a destinatarios reales). Configura RESEND_API_KEY o SMTP_HOST/USER/PASS para producción.`,
        );
      } catch (error) {
        this.logger.error("[MailService] No se pudo inicializar ningún transporte de correo.", error);
      }
    }
  }

  private getFromAddress(): string {
    return (
      this.configService.get<string>("SMTP_FROM") ||
      '"Sistema Gestión del Fin" <noreply@doomsday-system-api.onrender.com>'
    );
  }

  private async sendMail(opts: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    if (this.resend) {
      const from =
        this.configService.get<string>("RESEND_FROM") ||
        "Sistema Admisiones <onboarding@resend.dev>";
      const result = await this.resend.emails.send({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
      this.logger.log(
        `[MailService] Resend: correo enviado a ${opts.to} — id=${result.data?.id ?? "?"}`,
      );
      return;
    }

    if (this.transporter) {
      const info = await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
      this.logger.log(
        `[MailService] SMTP: correo enviado a ${opts.to} — id=${info.messageId}`,
      );
      if (!this.configService.get<string>("SMTP_HOST")) {
        this.logger.log(
          `[MailService] Vista previa Ethereal: ${nodemailer.getTestMessageUrl(info)}`,
        );
      }
      return;
    }

    this.logger.warn(
      `[MailService] No hay proveedor de correo configurado. El correo a ${opts.to} NO fue enviado.`,
    );
  }

  async sendAdmissionDecision(
    email: string,
    decision: string,
    reportHtml: string,
    campName: string,
    registrationToken?: string,
  ) {
    const isAccepted = decision === "accepted";
    const subject = isAccepted
      ? `[TRANSMISIÓN SEGURA] Has sido aceptado en ${campName}`
      : `[TRANSMISIÓN SEGURA] Decisión de Admisión: ${campName}`;

    let body = `
      <div style="background-color:#e5e0d8;padding:40px 20px;font-family:'Courier New',Courier,monospace;color:#1a1a1a;">
        <div style="max-width:600px;margin:0 auto;background-color:#f4f1ea;padding:40px;border:1px solid #d0c9b4;box-shadow:0 10px 25px rgba(0,0,0,.2);">
          <div style="text-align:center;border-bottom:2px dashed #b5a990;padding-bottom:20px;margin-bottom:30px;">
            <div style="font-size:24px;font-weight:900;letter-spacing:2px;color:#2a2a2a;font-family:Impact,sans-serif;">GESTIÓN DEL FIN</div>
            <div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#5a5a5a;">SISTEMA OFICIAL DE ADMISIONES</div>
            <div style="display:inline-block;border:2px solid #8b0000;color:#8b0000;font-weight:bold;padding:4px 8px;margin-top:15px;font-family:'Courier New',monospace;letter-spacing:2px;">[ DOCUMENTO CLASIFICADO ]</div>
          </div>
          <div style="font-size:14px;line-height:1.6;color:#2d2d2d;">
            <p><strong>FECHA:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>ASUNTO:</strong> RESOLUCIÓN DE ADMISIÓN — ${campName}</p>
            <div style="text-align:center;margin:40px 0;">
              <div style="display:inline-block;border:4px solid ${isAccepted ? "#0f5132" : "#842029"};color:${isAccepted ? "#0f5132" : "#842029"};font-size:28px;font-weight:900;padding:10px 20px;letter-spacing:6px;opacity:.8;font-family:Impact,sans-serif;">
                ${isAccepted ? "APROBADO" : "DENEGADO"}
              </div>
            </div>
            <div style="background-color:rgba(0,0,0,.03);border:1px solid #d0c9b4;padding:20px;font-size:13px;">
              <h3 style="margin-top:0;font-size:14px;text-transform:uppercase;border-bottom:1px solid #b5a990;padding-bottom:5px;">INFORME TÉCNICO</h3>
              ${reportHtml.replace(/\n/g, "<br/>")}
            </div>
          </div>`;

    if (isAccepted && registrationToken) {
      const frontendUrl =
        this.configService.get<string>("FRONTEND_URL") || "http://localhost:5173";
      const registrationLink = `${frontendUrl}/register?token=${registrationToken}`;
      body += `
          <div style="margin-top:40px;border-top:2px dashed #b5a990;padding-top:30px;">
            <p style="font-weight:bold;font-size:15px;">INSTRUCCIONES DE INGRESO:</p>
            <div style="background-color:#fffdf7;border:2px solid #5a5a5a;border-left:10px solid #5a5a5a;padding:20px;margin-top:20px;text-align:center;">
              <div style="font-weight:900;font-size:18px;margin-bottom:15px;font-family:Impact,sans-serif;letter-spacing:2px;">PASE DE ABORDAJE</div>
              <a href="${registrationLink}" style="display:inline-block;background-color:#2a2a2a;color:#fff;font-weight:bold;padding:12px 25px;text-decoration:none;text-transform:uppercase;letter-spacing:2px;font-size:14px;">RECLAMAR IDENTIFICACIÓN</a>
              <p style="font-size:10px;color:#5a5a5a;margin-top:15px;">ESTE PASE CADUCA EN 48 HORAS.</p>
            </div>
          </div>`;
    }

    body += `
          <div style="margin-top:50px;font-size:11px;color:#5a5a5a;border-top:1px solid #d0c9b4;padding-top:10px;text-align:right;">
            <p>___________________________</p><p>OFICIAL A CARGO</p>
          </div>
        </div>
      </div>`;

    await this.sendMail({ to: email, subject, html: body });
  }

  async sendAccountCredentials(
    email: string,
    username: string,
    password: string,
    campName: string,
  ) {
    const frontendUrl =
      this.configService.get<string>("FRONTEND_URL") || "http://localhost:5173";
    const subject = `[TRANSMISIÓN SEGURA] Credenciales de acceso — ${campName}`;

    const body = `
      <div style="background-color:#e5e0d8;padding:40px 20px;font-family:'Courier New',Courier,monospace;color:#1a1a1a;">
        <div style="max-width:600px;margin:0 auto;background-color:#f4f1ea;padding:40px;border:1px solid #d0c9b4;box-shadow:0 10px 25px rgba(0,0,0,.2);">
          <div style="text-align:center;border-bottom:2px dashed #b5a990;padding-bottom:20px;margin-bottom:30px;">
            <div style="font-size:24px;font-weight:900;letter-spacing:2px;color:#2a2a2a;font-family:Impact,sans-serif;">GESTIÓN DEL FIN</div>
            <div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#5a5a5a;">SISTEMA OFICIAL DE ADMISIONES</div>
            <div style="display:inline-block;border:2px solid #0f5132;color:#0f5132;font-weight:bold;padding:4px 12px;margin-top:15px;letter-spacing:2px;">[ ACCESO AUTORIZADO ]</div>
          </div>
          <div style="font-size:14px;line-height:1.8;color:#2d2d2d;">
            <p><strong>FECHA:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>CAMPAMENTO:</strong> ${campName}</p>
            <p>Sus credenciales de acceso han sido generadas. Guárdelas en lugar seguro.</p>
            <div style="background-color:#fffdf7;border:2px solid #5a5a5a;border-left:8px solid #0f5132;padding:24px;margin:30px 0;font-family:'Courier New',monospace;">
              <div style="font-weight:900;font-size:14px;letter-spacing:2px;margin-bottom:16px;text-transform:uppercase;">CREDENCIALES DE ACCESO</div>
              <div style="margin-bottom:10px;">
                <span style="font-size:11px;color:#666;text-transform:uppercase;display:block;">Usuario</span>
                <span style="font-size:18px;font-weight:bold;color:#1a1a1a;letter-spacing:1px;">${username}</span>
              </div>
              <div style="margin-top:14px;">
                <span style="font-size:11px;color:#666;text-transform:uppercase;display:block;">Contraseña temporal</span>
                <span style="font-size:18px;font-weight:bold;color:#8b0000;letter-spacing:2px;font-family:monospace;">${password}</span>
              </div>
            </div>
            <div style="text-align:center;margin:30px 0;">
              <a href="${frontendUrl}/login" style="display:inline-block;background-color:#2a2a2a;color:#fff;font-weight:bold;padding:14px 30px;text-decoration:none;text-transform:uppercase;letter-spacing:2px;font-size:14px;">INGRESAR AL SISTEMA</a>
            </div>
            <p style="font-size:12px;color:#666;">Se recomienda cambiar la contraseña tras el primer inicio de sesión.</p>
          </div>
          <div style="margin-top:40px;font-size:11px;color:#5a5a5a;border-top:1px solid #d0c9b4;padding-top:10px;text-align:right;">
            <p>___________________________</p><p>OFICIAL A CARGO — ${campName}</p>
          </div>
        </div>
      </div>`;

    await this.sendMail({ to: email, subject, html: body });
  }
}
