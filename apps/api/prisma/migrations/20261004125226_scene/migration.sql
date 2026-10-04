-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Sensor" AS ENUM ('EO', 'SAR');

-- CreateTable
CREATE TABLE "scene" (
    "id" TEXT NOT NULL,
    "group_key" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "sensor" "Sensor" NOT NULL,
    "platform" TEXT NOT NULL,
    "acquired_at" TIMESTAMPTZ NOT NULL,
    "cloud_cover" DOUBLE PRECISION,
    "gsd_m" DOUBLE PRECISION NOT NULL,
    "footprint" geometry(MultiPolygon, 4326) NOT NULL,
    "thumbnail_url" TEXT,
    "updated_at" TIMESTAMPTZ,
    "stac" JSONB NOT NULL,

    CONSTRAINT "scene_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scene_acquired_at_id_idx" ON "scene"("acquired_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "scene_collection_idx" ON "scene"("collection");

-- CreateIndex
CREATE INDEX "scene_footprint_idx" ON "scene" USING GIST ("footprint");

-- Prisma는 CHECK 제약을 모델링하지 않아서 손으로 넣는다. 다음 migrate dev가 건드리지 않는다.
ALTER TABLE "scene" ADD CONSTRAINT "scene_cloud_cover_range" CHECK ("cloud_cover" IS NULL OR "cloud_cover" BETWEEN 0 AND 100);
