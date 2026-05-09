import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ResourcesService } from '../resources.service';

@Processor('daily-tasks')
export class DailyTasksProcessor extends WorkerHost {
  private readonly logger = new Logger(DailyTasksProcessor.name);

  constructor(private readonly resourcesService: ResourcesService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}...`);
    
    if (job.name === 'daily-resources') {
      await this.resourcesService.executeAllDailyProcesses();
    }
  }
}
