import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.init();
  }

  private async init() {
    const smtpHost = this.configService.get<string>("SMTP_HOST");
    const smtpPortStr = this.configService.get<string>("SMTP_PORT");
    const smtpPort = smtpPortStr ? parseInt(smtpPortStr, 10) : 587;
    const smtpUser = this.configService.get<string>("SMTP_USER");
    const smtpPass = this.configService.get<string>("SMTP_PASS");

    if (smtpHost && smtpUser && smtpPass) {
      // Usar proveedor SMTP real (Render/Produccion)
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log(`SMTP account configured with host: ${smtpHost}`);
    } else {
      // Generar cuenta de prueba Ethereal en tiempo de ejecución para el desarrollo si no hay variables
      try {
        const testAccount = await nodemailer.createTestAccount();

        this.transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.logger.log(
          `Ethereal Email test account configured: ${testAccount.user}. Set SMTP_HOST, SMTP_USER, and SMTP_PASS to use a real provider.`,
        );
      } catch (error) {
        this.logger.error("Failed to create Ethereal test account", error);
      }
    }
  }

  async sendAdmissionDecision(
    email: string,
    decision: string,
    reportHtml: string,
    campName: string,
    registrationToken?: string,
  ) {
    if (!this.transporter) {
      this.logger.warn("Transporter not initialized yet. Skipping email send.");
      return;
    }

    const isAccepted = decision === "accepted";
    const subject = isAccepted
      ? `[TRANSMISIÓN SEGURA] Has sido aceptado en el ${campName}`
      : `[TRANSMISIÓN SEGURA] Decisión de Admisión: ${campName}`;

    let body = `
      <div style="background-color: #e5e0d8; padding: 40px 20px; font-family: 'Courier New', Courier, monospace; color: #1a1a1a; min-height: 100vh;">
        
        <!-- Paper Container -->
        <div style="max-width: 600px; margin: 0 auto; background-color: #f4f1ea; padding: 40px; border: 1px solid #d0c9b4; box-shadow: 0 10px 25px rgba(0,0,0,0.2), inset 0 0 40px rgba(150,130,100,0.1); position: relative; overflow: hidden;">
          
          <!-- Top Confidential Stamp -->
          <div style="text-align: center; border-bottom: 2px dashed #b5a990; padding-bottom: 20px; margin-bottom: 30px;">
            <div style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #2a2a2a; font-family: Impact, sans-serif;">GESTIÓN DEL FIN</div>
            <div style="font-size: 12px; font-weight: bold; letter-spacing: 2px; color: #5a5a5a;">SISTEMA OFICIAL DE ADMISIONES</div>
            <div style="display: inline-block; border: 2px solid #8b0000; color: #8b0000; font-weight: bold; padding: 4px 8px; margin-top: 15px; transform: rotate(-5deg); font-family: 'Courier New', Courier, monospace; letter-spacing: 2px;">
              [ DOCUMENTO CLASIFICADO ]
            </div>
          </div>

          <div style="font-size: 14px; line-height: 1.6; color: #2d2d2d;">
            <p><strong>FECHA:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>A:</strong> SOLICITANTE CIVIL</p>
            <p><strong>ASUNTO:</strong> RESOLUCIÓN DE ADMISIÓN - ${campName}</p>
            <br/>
            
            <p>Por medio del presente documento oficial, la Agencia Federal notifica la resolución del comité de evaluación correspondiente a su solicitud de ingreso al <strong>${campName}</strong>.</p>
            
            <!-- Rubber Stamp for Decision -->
            <div style="text-align: center; margin: 40px 0;">
              <div style="display: inline-block; border: 4px solid ${isAccepted ? "#0f5132" : "#842029"}; color: ${isAccepted ? "#0f5132" : "#842029"}; font-size: 28px; font-weight: 900; padding: 10px 20px; letter-spacing: 6px; transform: rotate(${isAccepted ? "-2deg" : "3deg"}); opacity: 0.8; font-family: Impact, sans-serif;">
                ${isAccepted ? "APROBADO" : "DENEGADO"}
              </div>
            </div>

            <div style="background-color: rgba(0,0,0,0.03); border: 1px solid #d0c9b4; padding: 20px; font-size: 13px;">
              <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #b5a990; padding-bottom: 5px;">ANEXO A: INFORME MÉDICO / TÉCNICO</h3>
              ${reportHtml.replace(/\n/g, "<br/>")}
            </div>
          </div>
    `;

    if (isAccepted && registrationToken) {
      const frontendUrl =
        this.configService.get<string>("FRONTEND_URL") ||
        "http://localhost:5173";
      const registrationLink = `${frontendUrl}/register?token=${registrationToken}`;

      body += `
          <div style="margin-top: 40px; border-top: 2px dashed #b5a990; padding-top: 30px;">
            <p style="font-weight: bold; font-size: 15px; color: #1a1a1a;">INSTRUCCIONES DE INGRESO:</p>
            <p style="font-size: 13px;">Se adjunta a este expediente su código de autorización. Debe presentarlo en el punto de control para forjar su identidad de residente.</p>
            
            <!-- Ticket / Pass -->
            <div style="background-color: #fffdf7; border: 2px solid #5a5a5a; border-left: 10px solid #5a5a5a; padding: 20px; margin-top: 20px; text-align: center; box-shadow: 3px 3px 0 rgba(0,0,0,0.1);">
              <div style="font-weight: 900; font-size: 18px; margin-bottom: 15px; font-family: Impact, sans-serif; letter-spacing: 2px;">PASE DE ABORDAJE - ZONA SEGURA</div>
              <a href="${registrationLink}" style="display: inline-block; background-color: #2a2a2a; color: #fff; font-weight: bold; padding: 12px 25px; text-decoration: none; text-transform: uppercase; letter-spacing: 2px; font-size: 14px; border-radius: 2px;">
                RECLAMAR IDENTIFICACIÓN
              </a>
              <p style="font-size: 10px; color: #5a5a5a; margin-top: 15px;">ESTE PASE CADUCA EN 48 HORAS. USO EXCLUSIVO Y PERSONAL.</p>
            </div>
          </div>
      `;
    }

    body += `
          <div style="margin-top: 50px; font-size: 11px; color: #5a5a5a; text-align: justify; border-top: 1px solid #d0c9b4; padding-top: 10px;">
            <p>Este documento fue generado y sellado de manera automatizada. Cualquier falsificación de este documento resultará en la negación permanente de ingreso a todas las Zonas de Cuarentena (ZC) bajo jurisdicción de la Agencia.</p>
            <div style="margin-top: 20px; text-align: right;">
               <p>___________________________</p>
               <p>OFICIAL A CARGO</p>
            </div>
          </div>
          
        </div>
      </div>
    `;

    try {
      const info = await this.transporter.sendMail({
        from:
          this.configService.get<string>("SMTP_FROM") ||
          '"Sistema de Gestión del Fin" <system@doomsday.local>',
        to: email,
        subject: subject,
        html: body,
      });

      this.logger.log(`Message sent: ${info.messageId}`);

      // Mostrar la URL de prueba solo si no estamos usando un SMTP de producción real
      if (!this.configService.get<string>("SMTP_HOST")) {
        this.logger.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
      return info;
    } catch (error) {
      this.logger.error("Error sending email", error);
      throw error;
    }
  }
}
