ALTER TABLE "images"
ALTER COLUMN "embeddedImage" SET DATA TYPE vector(1536)
USING "embeddedImage"::vector;
