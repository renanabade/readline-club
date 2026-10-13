ALTER TABLE resources ADD COLUMN kind TEXT NOT NULL DEFAULT 'link' CHECK(kind IN ('summary_pdf','summary_epub','slides','transcript','link'));
