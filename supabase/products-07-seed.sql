insert into public.products
  (id, type, badge, title, description, specs, images, save_tag, price, old_price, default_whatsapp_msg, display_order)
values
  ('shrimp', 'single', 'Treat', 'Freeze Dried Shrimp', 'Natural & protein-rich nutritional treat ideal for Discus, Arowana, Cichlids, Flowerhorn, Oscar, Snakehead, and other carnivorous fish.', '["<strong>Protein:</strong> Min 55%", "<strong>Sizes:</strong> 35g, 50g, 100g", "<strong>Features:</strong> No added preservatives, natural color booster."]'::jsonb, '[]'::jsonb, null, null, null, 'Hi Petify, I want to order Freeze Dried Shrimp', 1),
  ('channa', 'single', 'Specialized Feed', 'Channa Stick (125g)', 'Premium protein-rich fish food formulated specifically for Snakehead (Channa spp.) and carnivorous fish.', '["<strong>Protein:</strong> Min 45%", "<strong>Net Wt:</strong> 125g", "<strong>Features:</strong> Omega-3 rich, boosts immunity, enhances natural pattern & color."]'::jsonb, '[]'::jsonb, null, null, null, 'Hi Petify, I want to order Channa Stick 125g', 2),
  ('arowana', 'single', 'Premium Feed', 'Arowana Stick (125g)', 'Specially formulated for Arowana and large top/mid-water predators for healthy growth and vitality.', '["<strong>Protein:</strong> Min 45%", "<strong>Net Wt:</strong> 125g", "<strong>Features:</strong> Fortified with vitamins & minerals for disease resistance."]'::jsonb, '[]'::jsonb, null, null, null, 'Hi Petify, I want to order Arowana Stick 125g', 3),
  ('artemia-stick', 'single', 'Premium Feed', 'Artemia Stick (150g)', 'Natural source of protein from Artemia designed to enhance growth, color, and immunity for Discus, Arowana, Cichlids, Flowerhorn, Oscar, Snakehead, and other ornamental fish.', '["<strong>Protein:</strong> Min 48%", "<strong>Net Wt:</strong> 150g", "<strong>Features:</strong> Easy to digest, natural color booster, immune support."]'::jsonb, '[]'::jsonb, null, null, null, 'Hi Petify, I want to order Artemia Stick 150g', 4),
  ('blood-worm-stick', 'single', 'Premium Feed', 'Blood Worm Stick (150g)', 'Highly nutritious feed made with natural blood worm, rich in protein and carotenoids to boost immunity, growth, and natural colors.', '["<strong>Protein:</strong> Min 40%", "<strong>Net Wt:</strong> 150g", "<strong>Features:</strong> Soft texture, easy to digest, clean water formula."]'::jsonb, '[]'::jsonb, null, null, null, 'Hi Petify, I want to order Blood Worm Stick 150g', 5),
  ('krill-pellets', 'single', 'Premium Feed', 'Krill Pellets (150g)', 'High-quality marine protein source enriched with Antarctic Krill Meal, Omega-3 fatty acids, and natural Astaxanthin for vibrant color and vitality.', '["<strong>Protein:</strong> Min 48%", "<strong>Net Wt:</strong> 150g", "<strong>Features:</strong> Astaxanthin 100 ppm, enhances color, supports muscle growth."]'::jsonb, '[]'::jsonb, null, null, null, 'Hi Petify, I want to order Krill Pellets 150g', 6),
  ('combo-1', 'combo', 'Starter Combo', 'Channa Stick + Shrimp 35g', 'Channa Stick 125g + Freeze Dried Shrimp 35g', '[]'::jsonb, '[]'::jsonb, 'SAVE ₹65', '₹599', '₹664', 'Hi Petify, I want to order Combo ₹599', 7),
  ('combo-2', 'combo', 'Popular Combo', 'Channa Stick + Shrimp 50g', 'Channa Stick 125g + Freeze Dried Shrimp 50g', '[]'::jsonb, '[]'::jsonb, 'SAVE ₹79', '₹699', '₹778', 'Hi Petify, I want to order Combo ₹699', 8),
  ('combo-3', 'combo', 'Value Combo', 'Channa Stick + Shrimp 100g', 'Channa Stick 125g + Freeze Dried Shrimp 100g', '[]'::jsonb, '[]'::jsonb, 'SAVE ₹99', '₹899', '₹998', 'Hi Petify, I want to order Combo ₹899', 9)
on conflict (id) do update set
  type = excluded.type,
  badge = excluded.badge,
  title = excluded.title,
  description = excluded.description,
  specs = excluded.specs,
  save_tag = excluded.save_tag,
  price = excluded.price,
  old_price = excluded.old_price,
  default_whatsapp_msg = excluded.default_whatsapp_msg,
  display_order = excluded.display_order;

update public.products
set section_id = case when type = 'combo' then 'combos' else 'singles' end
where id in (
  'shrimp', 'channa', 'arowana', 'artemia-stick', 'blood-worm-stick', 'krill-pellets',
  'combo-1', 'combo-2', 'combo-3'
);