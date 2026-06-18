-- CreateEnum
CREATE TYPE "UserGender" AS ENUM ('male', 'female');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "gender" "UserGender";
