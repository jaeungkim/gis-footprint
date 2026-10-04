import { Module } from '@nestjs/common';
import { CatalogLoader } from './catalog.loader.js';
import {
  CatalogRepository,
  InMemoryCatalogRepository,
} from './catalog.repository.js';
import { ScenesController } from './scenes.controller.js';

@Module({
  controllers: [ScenesController],
  providers: [
    { provide: CatalogRepository, useClass: InMemoryCatalogRepository },
    CatalogLoader,
  ],
})
export class CatalogModule {}
