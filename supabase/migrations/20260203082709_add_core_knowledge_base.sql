
-- Insert core business context into knowledge_base
INSERT INTO public.knowledge_base (content, metadata, source, category) VALUES 
(
  'We are Personal Trainers Dubai (PTD), a premier personal training company operating in Dubai and Abu Dhabi. We provide mobile personal training services, meaning we come to the client''s location - whether it''s their home, gym, or a park. We do not have a single physical gym where clients come to us; instead, we bring the gym and the trainer to them. We specialize in customized fitness plans, weight loss, muscle building, and overall health improvement.',
  '{"topics": ["about us", "locations", "services", "mobile training"]}',
  'core_business_context',
  'general'
);
