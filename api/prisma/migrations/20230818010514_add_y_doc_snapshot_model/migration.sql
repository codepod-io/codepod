-- CreateTable
CREATE TABLE "YDocSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT,
    "yDocBlob" BYTEA,
    "repoId" TEXT,

    CONSTRAINT "YDocSnapshot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "YDocSnapshot" ADD CONSTRAINT "YDocSnapshot_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
