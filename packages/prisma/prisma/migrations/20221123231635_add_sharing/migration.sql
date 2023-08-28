-- AlterTable
ALTER TABLE "Repo" ADD COLUMN     "collaboratorIds" TEXT[],
ADD COLUMN     "public" BOOLEAN NOT NULL DEFAULT false;
