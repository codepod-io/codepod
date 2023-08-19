-- CreateTable
CREATE TABLE "YDocSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT,
    "yDocBlob" BYTEA NOT NULL,
    "repoId" TEXT NOT NULL,

    CONSTRAINT "YDocSnapshot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "YDocSnapshot" ADD CONSTRAINT "YDocSnapshot_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
