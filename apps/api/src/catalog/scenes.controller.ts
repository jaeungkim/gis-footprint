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
    // Postgres text는 NUL을 못 받아서 쿼리가 500으로 터진다. 그런 id는 있을 수 없으니 바로 404.
    const scene = id.includes('\0') ? null : await this.catalog.findById(id);
    if (!scene) throw new NotFoundException(`scene ${id} 없음`);
    return toSceneFeature(scene);
  }
}
