import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CollectionsController } from './collections.controller.js';
import { CollectionsSnapshot } from './collections.snapshot.js';
import { LandingController } from './landing.controller.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

// STAC API(/api/stac/*). HTTP를 SceneQuery로 바꿔 CatalogRepository에 넘기는 일만 한다.
@Module({
  imports: [CatalogModule],
  controllers: [LandingController, CollectionsController, SearchController],
  providers: [SearchService, CollectionsSnapshot],
})
export class StacModule {}
