-- 027: Planner settings for the Coolify VPS.
--
-- effective_cache_size was 128 MB (same as shared_buffers), telling the planner
-- almost nothing is cached. random_page_cost 4 is a spinning-disk assumption.
-- Both are planner estimates only — neither allocates memory.
--
-- shared_buffers still needs a Postgres restart and is set outside the DB.

ALTER DATABASE postgres SET effective_cache_size = '1GB';
ALTER DATABASE postgres SET random_page_cost = 1.1;
