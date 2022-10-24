import {
  Body,
  Controller,
  Get, HttpCode,
  Param,
  Post, Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiRedisParams } from 'src/decorators/api-redis-params.decorator';
import { ApiQueryRedisStringEncoding } from 'src/common/decorators';
import { BaseController } from 'src/modules/browser/controllers/base.controller';
import { CreateRedisearchIndexDto, SearchRedisearchDto } from 'src/modules/browser/dto/redisearch';
import { RedisearchService } from 'src/modules/browser/services/redisearch/redisearch.service';
import { GetKeysWithDetailsResponse } from 'src/modules/browser/dto';

@ApiTags('RediSearch')
@Controller('redisearch')
export class RedisearchController extends BaseController {
  constructor(private service: RedisearchService) {
    super();
  }

  @Get('')
  @ApiOperation({ description: 'Get list of available indexes' })
  @ApiRedisParams()
  @ApiQueryRedisStringEncoding()
  async list(
    @Param('dbInstance') dbInstance: string,
  ): Promise<string[]> {
    return await this.service.list(
      {
        instanceId: dbInstance,
      },
    );
  }

  @Post('')
  @ApiOperation({ description: 'Create redisearch index' })
  @ApiRedisParams()
  @HttpCode(201)
  @ApiBody({ type: CreateRedisearchIndexDto })
  async createList(
    @Param('dbInstance') dbInstance: string,
      @Body() dto: CreateRedisearchIndexDto,
  ): Promise<void> {
    return await this.service.createIndex(
      {
        instanceId: dbInstance,
      },
      dto,
    );
  }

  @Get('search')
  @ApiOperation({ description: 'Search for keys in index' })
  @ApiRedisParams()
  @ApiQueryRedisStringEncoding()
  async search(
    @Param('dbInstance') dbInstance: string,
      @Query() dto: SearchRedisearchDto,
  ): Promise<GetKeysWithDetailsResponse> {
    return await this.service.search(
      {
        instanceId: dbInstance,
      },
      dto,
    );
  }
}
