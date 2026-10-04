import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiNotFoundResponse } from '@nestjs/swagger';
import { CatalogRepository } from './catalog.repository.js';
import { SceneFeatureDto, toSceneFeature } from './dto/scene-feature.dto.js';

@Controller('scenes')
export class ScenesController {
  constructor(private readonly catalog: CatalogRepository) {}

  @Get(':id')
  @ApiNotFoundResponse()
  async findOne(@Param('id') id: string): Promise<SceneFeatureDto> {
    const scene = await this.catalog.findById(id);
    if (!scene) throw new NotFoundException(`scene ${id} 없음`);
    return toSceneFeature(scene);
  }
}
