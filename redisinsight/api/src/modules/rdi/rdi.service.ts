import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { CreateRdiDto, UpdateRdiDto } from 'src/modules/rdi/dto';
import { Rdi, RdiClientMetadata } from 'src/modules/rdi/models';
import { RdiRepository } from 'src/modules/rdi/repository/rdi.repository';
import { classToClass } from 'src/utils';
import { RdiClientProvider } from 'src/modules/rdi/providers/rdi.client.provider';
import { RdiClientFactory } from 'src/modules/rdi/providers/rdi.client.factory';
import { SessionMetadata } from 'src/common/models';
import { wrapRdiPipelineError } from 'src/modules/rdi/exceptions';
import { RdiAnalytics } from './rdi.analytics';

@Injectable()
export class RdiService {
  private logger = new Logger('RdiService');

  constructor(
    private readonly repository: RdiRepository,
    private readonly analytics: RdiAnalytics,
    private readonly rdiClientProvider: RdiClientProvider,
    private readonly rdiClientFactory: RdiClientFactory,
  ) {}

  async list(): Promise<Rdi[]> {
    return await this.repository.list();
  }

  async get(id: string): Promise<Rdi> {
    const rdi = await this.repository.get(id);

    if (!rdi) {
      throw new Error('TBD not found');
    }

    return rdi;
  }

  async update(rdiClientMetadata: RdiClientMetadata, dto: UpdateRdiDto): Promise<Rdi> {
    // TODO update dto to get only updated fields
    const model = classToClass(Rdi, dto);

    await this.rdiClientProvider.delete(rdiClientMetadata);

    try {
      await this.rdiClientFactory.createClient(rdiClientMetadata, model);
    } catch (error) {
      throw wrapRdiPipelineError(error);
    }
    return await this.repository.update(rdiClientMetadata.id, model);
  }

  async create(sessionMetadata: SessionMetadata, dto: CreateRdiDto): Promise<Rdi> {
    const model = classToClass(Rdi, dto);
    model.lastConnection = new Date();
    // TODO add request to get version
    model.version = '1.2';

    const rdiClientMetadata = {
      sessionMetadata,
    };

    try {
      await this.rdiClientFactory.createClient(rdiClientMetadata, model);
    } catch (error) {
      this.logger.error('Failed to create rdi instance');

      throw wrapRdiPipelineError(error);
    }

    this.logger.log('Succeed to create rdi instance');
    return await this.repository.create(model);
  }

  async delete(ids: string[]): Promise<void> {
    try {
      await this.repository.delete(ids);
      await Promise.all(
        ids.map(async (id) => {
          await this.rdiClientProvider.deleteManyByRdiId(id);
        }),
      );

      this.analytics.sendRdiInstanceDeleted(ids.length);
    } catch (error) {
      this.logger.error(`Failed to delete instance(s): ${ids}`, error.message);
      this.analytics.sendRdiInstanceDeleted(ids.length, error.message);
      throw new InternalServerErrorException();
    }
  }

  /**
   * Connect to rdi instance
   * @param rdiClientMetadata
   */
  async connect(rdiClientMetadata: RdiClientMetadata): Promise<void> {
    try {
      await this.rdiClientProvider.getOrCreate(rdiClientMetadata);
    } catch (error) {
      this.logger.error(`Failed to connect to rdi instance ${rdiClientMetadata.id}`);
      throw wrapRdiPipelineError(error);
    }

    this.logger.log(`Succeed to connect to rdi instance ${rdiClientMetadata.id}`);
  }
}
