-- 002_seed.sql (UTF-8)

DELETE FROM points;
DELETE FROM exhibitions WHERE slug = 'polotsk-collegium';

INSERT INTO exhibitions (slug, title, description)
VALUES
('polotsk-collegium', 'Иезуитский коллегиум в Полоцке', 'Демонстрационная экспозиция для аудиогида');

INSERT INTO points (exhibition_id, slug, title, description)
SELECT e.id, 'facade', 'Фасад', 'Краткое описание точки "Фасад"'
FROM exhibitions e
WHERE e.slug = 'polotsk-collegium';

INSERT INTO points (exhibition_id, slug, title, description)
SELECT e.id, 'courtyard', 'Внутренний двор', 'Краткое описание точки "Внутренний двор"'
FROM exhibitions e
WHERE e.slug = 'polotsk-collegium';
