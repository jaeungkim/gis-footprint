import { Module } from '@nestjs/common';
import { CatalogLoader } from './catalog.loader.js';
import {
  CatalogRepository,
  PostgisCatalogRepository,
} from './catalog.repository.js';
import { ScenesController } from './scenes.controller.js';

@Module({
  controllers: [ScenesController],
  exports: [CatalogRepository],
  providers: [
    { provide: CatalogRepository, useClass: PostgisCatalogRepository },
    CatalogLoader,
  ],
})
export class CatalogModule {}
