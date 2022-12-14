import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkbenchCommandsExecutor } from 'src/modules/workbench/providers/workbench-commands.executor';
import { CreateCommandExecutionDto } from 'src/modules/workbench/dto/create-command-execution.dto';
import { CommandNotSupportedError } from 'src/modules/cli/constants/errors';
import ERROR_MESSAGES from 'src/constants/error-messages';
import { PluginCommandExecution } from 'src/modules/workbench/models/plugin-command-execution';
import { plainToClass } from 'class-transformer';
import { PluginCommandsWhitelistProvider } from 'src/modules/workbench/providers/plugin-commands-whitelist.provider';
import { CommandExecutionStatus } from 'src/modules/cli/dto/cli.dto';
import { CommandExecutionResult } from 'src/modules/workbench/models/command-execution-result';
import { CreatePluginStateDto } from 'src/modules/workbench/dto/create-plugin-state.dto';
import { PluginStateProvider } from 'src/modules/workbench/providers/plugin-state.provider';
import { PluginState } from 'src/modules/workbench/models/plugin-state';
import config from 'src/utils/config';
import { ClientMetadata } from 'src/common/models';

const PLUGINS_CONFIG = config.get('plugins');

@Injectable()
export class PluginsService {
  constructor(
    private commandsExecutor: WorkbenchCommandsExecutor,
    private pluginStateProvider: PluginStateProvider,
    private whitelistProvider: PluginCommandsWhitelistProvider,
  ) {}

  /**
   * Send redis command from workbench and save history
   *
   * @param clientMetadata
   * @param dto
   */
  async sendCommand(
    clientMetadata: ClientMetadata,
    dto: CreateCommandExecutionDto,
  ): Promise<PluginCommandExecution> {
    try {
      await this.checkWhitelistedCommands(clientMetadata, dto.command);

      const result = await this.commandsExecutor.sendCommand(clientMetadata, dto);

      return plainToClass(PluginCommandExecution, {
        ...dto,
        databaseId: clientMetadata.databaseId,
        result,
      });
    } catch (error) {
      if (error instanceof CommandNotSupportedError) {
        return new PluginCommandExecution({
          ...dto,
          databaseId: clientMetadata.databaseId,
          result: [new CommandExecutionResult({
            response: error.message,
            status: CommandExecutionStatus.Fail,
          })],
        });
      }

      throw error;
    }
  }

  /**
   * Get database white listed commands for plugins
   * @param clientMetadata
   */
  async getWhitelistCommands(clientMetadata: ClientMetadata): Promise<string[]> {
    return await this.whitelistProvider.getWhitelistCommands(clientMetadata);
  }

  /**
   * Save plugin state
   *
   * @param visualizationId
   * @param commandExecutionId
   * @param dto
   */
  async saveState(visualizationId: string, commandExecutionId: string, dto: CreatePluginStateDto): Promise<void> {
    if (JSON.stringify(dto.state).length > PLUGINS_CONFIG.stateMaxSize) {
      throw new BadRequestException(ERROR_MESSAGES.PLUGIN_STATE_MAX_SIZE(PLUGINS_CONFIG.stateMaxSize));
    }

    await this.pluginStateProvider.upsert({
      visualizationId,
      commandExecutionId,
      ...dto,
    });
  }

  /**
   * Get plugin state
   *
   * @param visualizationId
   * @param commandExecutionId
   */
  async getState(visualizationId: string, commandExecutionId: string): Promise<PluginState> {
    return this.pluginStateProvider.getOne(visualizationId, commandExecutionId);
  }

  /**
   * Check if command outside workbench commands black list
   * @param clientMetadata
   * @param commandLine
   * @private
   */
  private async checkWhitelistedCommands(clientMetadata: ClientMetadata, commandLine: string) {
    const targetCommand = commandLine.toLowerCase();

    const whitelist = await this.getWhitelistCommands(clientMetadata);

    if (!whitelist.find((command) => targetCommand.startsWith(command))) {
      throw new CommandNotSupportedError(
        ERROR_MESSAGES.PLUGIN_COMMAND_NOT_SUPPORTED(
          (targetCommand.split(' '))[0].toUpperCase(),
        ),
      );
    }
  }
}
