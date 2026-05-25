import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AiAdmission } from "./entities/ai-admission.entity";
import { Person } from "../users/entities/person.entity";
import { Camp } from "../camps/entities/camp.entity";
import { Profession } from "../users/entities/profession.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import { UsersModule } from "../users/users.module";
import { CampAnalysisService } from "./services/camp-analysis.service";
import { AiEvaluationService } from "./services/ai-evaluation.service";
import { AdmissionReviewService } from "./services/admission-review.service";
import { PythonAiService } from "./services/python-ai.service";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiAdmission,
      Person,
      Camp,
      Profession,
      UserAccount,
    ]),
    UsersModule,
    MailModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    CampAnalysisService,
    AiEvaluationService,
    AdmissionReviewService,
    PythonAiService,
  ],
  exports: [AiService],
})
export class AiModule {}
