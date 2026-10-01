-- 0001_dev.sql — development seed
--
-- Idempotent: safe to run repeatedly. Applied AFTER migrations, never as part
-- of them. See docs/architecture/11-deployment-and-environments.md#database-migrations.
--
-- Contents:
--   * one demo company with two job sites
--   * the staged North Carolina Lowe's store list (118 stores, from
--     External Notes/lowes-nc-stores.json)
--   * four demo orders mirroring the mockup data
--
-- The portal login itself cannot be seeded: profiles.id references auth.users,
-- and accounts are created through the Supabase admin API because self-signup
-- is disabled (ADR-0007). Create the user in the dashboard, then run the block
-- at the bottom of this file.

-- Company --------------------------------------------------------------------

insert into companies (name, order_alias, billing_email, phone)
values (
  'Acme Construction',
  'acme@orders.example.com',
  'billing@acme.example.com',
  '(864) 555-0142'
)
on conflict (order_alias) do nothing;

-- Job sites ------------------------------------------------------------------

insert into company_sites (
  company_id, label, address_line1, city, state, postal_code,
  contact_name, contact_phone, instructions, is_default
)
select
  c.id, s.label, s.address_line1, s.city, s.state, s.postal_code,
  s.contact_name, s.contact_phone, s.instructions, s.is_default
from companies c
cross join (values
  ('Oakwood Phase 2', '421 Commerce Rd, Bldg 3', 'Spartanburg', 'SC', '29301',
   'Dave', '(864) 555-0147', 'Gate code 4412 · ask for Dave', true),
  ('Warehouse', '12 Industrial Way', 'Spartanburg', 'SC', '29301',
   null, null, null, false)
) as s(label, address_line1, city, state, postal_code,
       contact_name, contact_phone, instructions, is_default)
where c.order_alias = 'acme@orders.example.com'
  and not exists (
    select 1 from company_sites cs
     where cs.company_id = c.id and cs.label = s.label
  );

-- Retailer stores ------------------------------------------------------------
-- Unique on (retailer, store_number), so re-running is a no-op.
-- store_url is deliberately absent: the column does not exist yet. It lands
-- with the start-an-order build, which is the first thing to need it.

insert into retailer_stores (
  retailer, store_number, name, address_line1, city, state, postal_code,
  lat, lng, phone
)
values
  ('lowes', '1529', 'Albemarle Lowe''s', '820 NC 24-27 BYPASS EAST', 'Albemarle', 'NC', '28001', 35.338686362526, -80.205267537299, '(704) 983-8956'),
  ('lowes', '1878', 'Apex Lowe''s', '1101 BEAVER CREEK COMMONS DR', 'Apex', 'NC', '27502', 35.744995352589, -78.873919153961, '(919) 303-4200'),
  ('lowes', '2201', 'S. Asheville Lowe''s', '19 MCKENNA ROAD', 'Arden', 'NC', '28704', 35.44730751951, -82.537499213358, '(828) 650-8000'),
  ('lowes', '0449', 'Asheboro Lowe''s', '1120 EAST DIXIE DR', 'Asheboro', 'NC', '27203', 35.694195653064, -79.795069949159, '(336) 629-6100'),
  ('lowes', '0526', 'W. Asheville Lowe''s', '95 SMOKEY PARK HWY', 'Asheville', 'NC', '28806', 35.565514527105, -82.626872723054, '(828) 255-9113'),
  ('lowes', '3617', 'East Asheville', '89 SOUTH TUNNEL ROAD', 'Asheville', 'NC', '28805', 35.579259784351, -82.521747222839, '(828) 299-3788'),
  ('lowes', '1834', 'Banner Elk Lowe''s', '2014 TYNECASTLE HIGHWAY', 'Banner Elk', 'NC', '28604', 36.1416925, -81.8609309, '(828) 897-8700'),
  ('lowes', '2650', 'Belmont Lowe''s', '200 CALDWELL FARM ROAD', 'Belmont', 'NC', '28012', 35.256308415468, -81.043009531413, '(704) 825-6405'),
  ('lowes', '1522', 'Boone Lowe''s', '1855 BLOWING ROCK ROAD', 'Boone', 'NC', '28607', 36.198467846189, -81.657307000646, '(828) 262-0773'),
  ('lowes', '1990', 'Brevard Lowe''s', '119 ECUSTA ROAD', 'Brevard', 'NC', '28712', 35.270929754287, -82.705771365935, '(828) 877-8630'),
  ('lowes', '0508', 'Burlington Lowe''s', '125 HUFFMAN MILL RD.', 'Burlington', 'NC', '27215', 36.07967659376, -79.483830731711, '(336) 226-5656'),
  ('lowes', '2436', 'Cape Carteret Lowe''s', '401 WB MCLEAN DRIVE', 'Cape Carteret', 'NC', '28584', 34.690435298818, -77.06545146483, '(252) 764-5000'),
  ('lowes', '0426', 'Cary Lowe''s', '2000 WALNUT ST', 'Cary', 'NC', '27518', 35.75886637159, -78.742397797296, '(919) 233-7000'),
  ('lowes', '1835', 'Morrisville Lowe''s', '1920 NW MAYNARD ROAD', 'Cary', 'NC', '27513', 35.799310414991, -78.794991887394, '(919) 380-3210'),
  ('lowes', '0487', 'Chapel Hill Lowe''s', '1801 FORDHAM BOULEVARD', 'Chapel Hill', 'NC', '27514', 35.9475886, -79.0128245, '(919) 967-3289'),
  ('lowes', '0377', 'Pineville Lowe''s', '10625 MCMULLEN CREEK PARKWAY', 'Charlotte', 'NC', '28226', 35.090092936432, -80.85736498263, '(704) 543-5600'),
  ('lowes', '0408', 'N. Charlotte Lowe''s', '1100 CHANCELLOR PARK DR.', 'Charlotte', 'NC', '28213', 35.293378152858, -80.742095143851, '(704) 597-2000'),
  ('lowes', '1060', 'S.W. Charlotte Lowe''s', '8192 SOUTH TRYON STREET', 'Charlotte', 'NC', '28273', 35.14461, -80.93166, '(704) 504-1147'),
  ('lowes', '1112', 'S. Charlotte Lowe''s', '5310 BALLANTYNE COMMONS PARKWAY', 'Charlotte', 'NC', '28277', 35.064638712992, -80.772979503594, '(704) 321-1050'),
  ('lowes', '1920', 'E. Charlotte Lowe''s', '8826 ALBEMARLE ROAD', 'Charlotte', 'NC', '28227', 35.211002402408, -80.695826983466, '(704) 563-3761'),
  ('lowes', '2348', 'Central Charlotte Lowe''s', '217 IVERSON WAY', 'Charlotte', 'NC', '28203', 35.205337787369, -80.862105722224, '(704) 335-5021'),
  ('lowes', '2352', 'Charlotte - Northlake Mall Lowe''s', '10275 PERIMETER PARKWAY', 'Charlotte', 'NC', '28216', 35.348463945639, -80.85252055941, '(704) 501-4420'),
  ('lowes', '1689', 'Clinton Lowe''s', '911 SUNSET AVENUE', 'Clinton', 'NC', '28328', 34.995967343135, -78.335388169906, '(910) 337-0000'),
  ('lowes', '0697', 'Concord Lowe''s', '940 CONCORD PARKWAY NORTH', 'Concord', 'NC', '28027', 35.426453144321, -80.614302116277, '(704) 720-9000'),
  ('lowes', '2981', 'S.W. Concord Lowe''s', '8670 CONCORD MILLS BLVD', 'Concord', 'NC', '28027', 35.37454169767, -80.728129414851, '(704) 652-4500'),
  ('lowes', '2636', 'E. Lincoln County Lowe''s', '7144 HIGHWAY 73', 'Denver', 'NC', '28037', 35.449806164682, -81.003389734865, '(704) 398-3701'),
  ('lowes', '0576', 'N. Durham Lowe''s', '117 WILLIAM PENN PLAZA', 'Durham', 'NC', '27704', 36.043147444824, -78.90034050682, '(919) 620-8579'),
  ('lowes', '2778', 'S. Durham Lowe''s', '4402 FAYETTEVILLE ROAD', 'Durham', 'NC', '27713', 35.941684183612, -78.90617854736, '(919) 206-4800'),
  ('lowes', '1713', 'Elizabeth City Lowe''s', '1605 WEST EHRINGHAUS STREET', 'Elizabeth City', 'NC', '27909', 36.292707225099, -76.245676745604, '(252) 331-6160'),
  ('lowes', '1653', 'Elkin Lowe''s', '492 CC CAMP RD', 'Elkin', 'NC', '28621', 36.27525705384, -80.840890230667, '(336) 526-6550'),
  ('lowes', '1777', 'Erwin Lowe''s', '524 EAST JACKSON BOULEVARD', 'Erwin', 'NC', '28339', 35.323866570403, -78.646109483038, '(910) 897-1120'),
  ('lowes', '0388', 'Fayetteville Lowe''s', '1929 SKIBO SQUARE', 'Fayetteville', 'NC', '28314', 35.066839718054, -78.966850806363, '(910) 487-5600'),
  ('lowes', '0767', 'N. Fayetteville Lowe''s', '3909 RAMSEY STREET', 'Fayetteville', 'NC', '28311', 35.113309102301, -78.879712197274, '(910) 822-0126'),
  ('lowes', '2905', 'W. Fayetteville Lowe''s', '7771 GOOD MIDDLING DRIVE', 'Fayetteville', 'NC', '28304', 35.0270395, -79.0576224, '(910) 213-1254'),
  ('lowes', '1788', 'Forest City Lowe''s', '184 LOWE''S BOULEVARD', 'Forest City', 'NC', '28043', 35.339464993111, -81.897432137379, '(828) 351-1023'),
  ('lowes', '0717', 'Franklin Lowe''s', '161 FRANKLIN PLAZA', 'Franklin', 'NC', '28734', 35.16622856043, -83.394870722975, '(828) 349-4654'),
  ('lowes', '0488', 'Garner Lowe''s', '1575 US HWY 70 WEST', 'Garner', 'NC', '27529', 35.723356, -78.6500449, '(919) 772-4466'),
  ('lowes', '0677', 'Clayton Lowe''s', '101 CLEVELAND CROSSING DRIVE', 'Garner', 'NC', '27529', 35.60799574974, -78.560043718393, '(919) 661-6440'),
  ('lowes', '0457', 'Franklin Square Lowe''s', '3250 EAST FRANKLIN BLVD.', 'Gastonia', 'NC', '28056', 35.25855144694, -81.121714566646, '(704) 865-6767'),
  ('lowes', '0557', 'Goldsboro Lowe''s', '1202 N BERKELEY BLVD', 'Goldsboro', 'NC', '27534', 35.381209600936, -77.931437372417, '(919) 778-9969'),
  ('lowes', '0387', 'N. Greensboro Lowe''s', '3001 BATTLEGROUND AVE.', 'Greensboro', 'NC', '27408', 36.116013609265, -79.836918909276, '(336) 545-2040'),
  ('lowes', '0404', 'S.W. Greensboro Lowe''s', '1703 SOUTH FORTY DR.', 'Greensboro', 'NC', '27407', 36.053694122853, -79.890369500654, '(336) 292-4813'),
  ('lowes', '2222', 'S.E. Greensboro Lowe''s', '109 WEST ELMSLEY DRIVE', 'Greensboro', 'NC', '27406', 36.003660844099, -79.795887476104, '(336) 333-2652'),
  ('lowes', '2771', 'N.E. Greensboro Lowe''s', '2005 EAST CONE BOULEVARD', 'Greensboro', 'NC', '27405', 36.113021930667, -79.753277516408, '(336) 541-1890'),
  ('lowes', '3643', 'Lowe''s Outlet Greensboro', '3729 Battleground Ave', 'Greensboro', 'NC', '27410', 36.132327421651, -79.85680180036, '(743) 902-5170'),
  ('lowes', '2837', 'E. Greenville Lowe''s', '3840 EAST 10TH STREET', 'Greenville', 'NC', '27858', 35.590443762723, -77.317600841191, '(252) 754-6640'),
  ('lowes', '2256', 'Surf City Lowe''s', '106 WILKES LN E', 'Hampstead', 'NC', '28443', 34.45194251079, -77.60833802993, '(910) 329-6952'),
  ('lowes', '0738', 'Henderson Lowe''s', '166 DABNEY ROAD', 'Henderson', 'NC', '27537', 36.320853148447, -78.416768020297, '(252) 436-0050'),
  ('lowes', '0031', 'Hendersonville Lowe''s', '1415 7TH AVE. EAST', 'Hendersonville', 'NC', '28792', 35.329522707298, -82.449838569744, '(828) 696-4900'),
  ('lowes', '1557', 'Hickory Lowe''s', '1550 21ST STREET DRIVE S.E.', 'Hickory', 'NC', '28602', 35.710727264441, -81.37705189195, '(828) 304-9063'),
  ('lowes', '2370', 'N. Hickory Lowe''s', '1450 2ND STREET NE', 'Hickory', 'NC', '28601', 35.751786949899, -81.336298803003, '(828) 304-6420'),
  ('lowes', '0459', 'N. High Point Lowe''s', '2600 NORTH MAIN ST.', 'High Point', 'NC', '27265', 35.9920891, -80.0262176, '(336) 889-8600'),
  ('lowes', '3316', 'Holly Springs Lowe''s', '2240 RALPH STEPHENS RD', 'Holly Springs', 'NC', '27540', 35.6303504, -78.8285668, '(919) 586-3155'),
  ('lowes', '2906', 'Hope Mills Lowe''s', '3080 N MAIN STREET', 'Hope Mills', 'NC', '28348', 34.981015232474, -78.96178065164, '(910) 364-0444'),
  ('lowes', '0489', 'Huntersville Lowe''s', '16830 STATESVILLE RD.', 'Huntersville', 'NC', '28078', 35.444516064558, -80.865904454703, '(704) 892-9449'),
  ('lowes', '2907', 'Indian Trail Lowe''s', '5711 WEST HIGHWAY 74', 'Indian Trail', 'NC', '28079', 35.062345000837, -80.635465786839, '(704) 225-7110'),
  ('lowes', '0556', 'Jacksonville Lowe''s', '1255 WESTERN BLVD.', 'Jacksonville', 'NC', '28546', 34.784159776072, -77.399352988692, '(910) 938-9100'),
  ('lowes', '2737', 'S. Jacksonville Lowe''s', '425 YOPP ROAD', 'Jacksonville', 'NC', '28540', 34.75161121658, -77.46102118246, '(910) 320-9030'),
  ('lowes', '2368', 'N. Concord Lowe''s', '3025 DALE EARNHARDT BLVD', 'Kannapolis', 'NC', '28083', 35.467417354712, -80.58928835906, '(704) 720-9810'),
  ('lowes', '1141', 'Kernersville Lowe''s', '145 HARMON CREEK ROAD', 'Kernersville', 'NC', '27284', 36.106959251415, -80.102959154734, '(336) 992-0509'),
  ('lowes', '3216', 'Kill Devil Hills Lowe''s', '1500 NORTH CROATAN HIGHWAY', 'Kill Devil Hills', 'NC', '27948', 36.025903561252, -75.668344340809, '(252) 449-2060'),
  ('lowes', '1722', 'Kinston Lowe''s', '4489 HIGHWAY 70 WEST', 'Kinston', 'NC', '28504', 35.261318077189, -77.648488930299, '(252) 520-5100'),
  ('lowes', '1095', 'Knightdale Lowe''s', '7316 KNIGHTDALE BLVD', 'Knightdale', 'NC', '27545', 35.798341573131, -78.484401294631, '(919) 266-1178'),
  ('lowes', '2564', 'Laurinburg Lowe''s', '910 US 401 BY-PASS', 'Laurinburg', 'NC', '28352', 34.7616229, -79.4792819, '(910) 610-2365'),
  ('lowes', '3478', 'Leland Lowe''s', '3716 GATEWAY BLVD', 'Leland', 'NC', '28451', 34.2119079, -78.01937, '(910) 998-4040'),
  ('lowes', '1509', 'Lenoir Lowe''s', '1201 HICKORY BLVD S.E.', 'Lenoir', 'NC', '28645', 35.898432456642, -81.522040413829, '(828) 726-5246'),
  ('lowes', '0490', 'Lexington Lowe''s', '130 LOWE''S BLVD.', 'Lexington', 'NC', '27292', 35.7915303689, -80.259768934121, '(336) 248-2300'),
  ('lowes', '0700', 'Lincolnton Lowe''s', '1603 EAST MAIN STREET', 'Lincolnton', 'NC', '28092', 35.4800018, -81.2337688, '(704) 748-9335'),
  ('lowes', '0739', 'Lumberton Lowe''s', '5060 FAYETTEVILLE RD.', 'Lumberton', 'NC', '28358', 34.665097091603, -79.001251026962, '(910) 738-2557'),
  ('lowes', '1922', 'Marion Lowe''s', '480 US 70 WEST', 'Marion', 'NC', '28752', 35.701650968649, -82.041718176186, '(828) 659-5960'),
  ('lowes', '1124', 'S.E. Charlotte Lowe''s', '2115 MATTHEWS TOWNSHIP PARKWAY', 'Matthews', 'NC', '28105', 35.12685990366, -80.704018290586, '(704) 321-7170'),
  ('lowes', '2996', 'Mayodan Lowe''s', '6844 NC HIGHWAY 135', 'Mayodan', 'NC', '27027', 36.41391223136, -79.946431905467, '(336) 427-1400'),
  ('lowes', '2517', 'Mebane Lowe''s', '200 LOWES BOULEVARD', 'Mebane', 'NC', '27302', 36.066301890292, -79.302717127318, '(919) 304-9401'),
  ('lowes', '2575', 'Mocksville Lowe''s', '1427 YADKINVILLE ROAD', 'Mocksville', 'NC', '27028', 35.9172642, -80.5871413, '(336) 936-2560'),
  ('lowes', '0680', 'Monroe Lowe''s', '2350 WEST ROOSEVELT BLVD', 'Monroe', 'NC', '28110', 35.009883198041, -80.563325760055, '(704) 226-1744'),
  ('lowes', '0595', 'Mooresville Lowe''s', '509 RIVER HWY', 'Mooresville', 'NC', '28117', 35.595045156551, -80.869017770708, '(704) 660-7177'),
  ('lowes', '0619', 'Morehead City Lowe''s', '5219 HWY. 70', 'Morehead City', 'NC', '28557', 34.739490455534, -76.812013744284, '(252) 727-5011'),
  ('lowes', '1097', 'Morganton Lowe''s', '1224 BURKEMONT AVENUE', 'Morganton', 'NC', '28655', 35.716674406712, -81.695710975737, '(828) 433-1102'),
  ('lowes', '0478', 'Mount Airy Lowe''s', '692 S. ANDY GRIFFITH PKY, STE100', 'Mount Airy', 'NC', '27030', 36.486236097646, -80.61534186336, '(336) 789-6100'),
  ('lowes', '2505', 'Murphy Lowe''s', '198 BULLDOG DRIVE', 'Murphy', 'NC', '28906', 35.099411887616, -84.017482018811, '(828) 835-4660'),
  ('lowes', '0566', 'New Bern Lowe''s', '1400 LOWE''S BOULEVARD', 'New Bern', 'NC', '28562', 35.0992113, -77.0886745, '(252) 638-6777'),
  ('lowes', '0907', 'North Wilkesboro Lowe''s', '1502 River Liberty Grove Road', 'North Wilkesboro', 'NC', '28659', 36.173172267217, -81.115713519692, '(800) 445-6937'),
  ('lowes', '2448', 'Pittsboro Lowe''s', '121 LOWE''S DRIVE', 'Pittsboro', 'NC', '27312', 35.744295360877, -79.165188042633, '(919) 642-4030'),
  ('lowes', '0444', 'N. Raleigh Lowe''s', '4601 CAPITAL BLVD.', 'Raleigh', 'NC', '27604', 35.844561478837, -78.58014446844, '(919) 850-9300'),
  ('lowes', '0625', 'W. Raleigh Lowe''s', '4831 GROVE BARTON RD', 'Raleigh', 'NC', '27613', 35.870748944581, -78.716602926379, '(919) 510-9667'),
  ('lowes', '1210', 'Reidsville Lowe''s', '5201 US 29 BUSINESS', 'Reidsville', 'NC', '27320', 36.378079, -79.6627193, '(336) 342-0553'),
  ('lowes', '1815', 'Roanoke Rapids Lowe''s', '1600 JULIAN ALLSBROOK HIGHWAY', 'Roanoke Rapids', 'NC', '27870', 36.433297824943, -77.635834487697, '(252) 535-3840'),
  ('lowes', '1038', 'Rockingham Lowe''s', '1300-A EAST BROAD AVENUE', 'Rockingham', 'NC', '28379', 34.92438566918, -79.753935566093, '(910) 410-0137'),
  ('lowes', '0547', 'Rocky Mount Lowe''s', '700 N. WESLEYAN BLVD.', 'Rocky Mount', 'NC', '27804', 35.963239549154, -77.819594834929, '(252) 451-1161'),
  ('lowes', '2210', 'Roxboro Lowe''s', '2044 DURHAM ROAD', 'Roxboro', 'NC', '27573', 36.366574021266, -78.982832685158, '(336) 330-2100'),
  ('lowes', '0495', 'Salisbury Lowe''s', '207 FAITH ROAD', 'Salisbury', 'NC', '28146', 35.654211216162, -80.458105560404, '(704) 638-0808'),
  ('lowes', '3608', 'Sanford Lowe''s', '3015 S HORNER BOULEVARD', 'Sanford', 'NC', '27332', 35.451673987229, -79.135351409756, '(919) 776-5644'),
  ('lowes', '1068', 'Shallotte Lowe''s', '351 WHITEVILLE RD NW', 'Shallotte', 'NC', '28470', 33.973335082532, -78.399891944866, '(910) 755-6111'),
  ('lowes', '0612', 'Shelby Lowe''s', '425 EARL ROAD', 'Shelby', 'NC', '28150', 35.277132552198, -81.53553453895, '(704) 484-9883'),
  ('lowes', '0647', 'Smithfield Lowe''s', '1230 N. BRIGHTLEAF BLVD.', 'Smithfield', 'NC', '27577', 35.519044120788, -78.314239483394, '(919) 934-6666'),
  ('lowes', '0538', 'Southern Pines Lowe''s', '10845 US 15-501 HWY', 'Southern Pines', 'NC', '28387', 35.162996063889, -79.421101028483, '(910) 693-1010'),
  ('lowes', '0682', 'Southport Lowe''s', '5084 SOUTHPORT SUPPLY RD SE', 'Southport', 'NC', '28461', 33.9538859, -78.0454624, '(910) 454-8761'),
  ('lowes', '0458', 'Statesville Lowe''s', '140 NORTH POINTE BLVD.', 'Statesville', 'NC', '28625', 35.817039352834, -80.881087809563, '(704) 878-9440'),
  ('lowes', '2257', 'Sylva Lowe''s', '1716 EAST MAIN STREET', 'Sylva', 'NC', '28779', 35.357232603, -83.201117262067, '(828) 586-1170'),
  ('lowes', '3022', 'Tarboro Lowe''s', '111 RIVER OAKS DRIVE', 'Tarboro', 'NC', '27886', 35.883153572057, -77.548209825176, '(252) 824-2200'),
  ('lowes', '0762', 'Troutman Lowe''s', '286 Houston Rd', 'Troutman', 'NC', '28166', 35.677228199635, -80.846934127795, '(704) 980-1135'),
  ('lowes', '2750', 'Troutman Lowe''s', '1041 CHARLOTTE HIGHWAY', 'Troutman', 'NC', '28166', 35.669816674318, -80.853462456917, '(704) 980-5000'),
  ('lowes', '2255', 'W. Jefferson Lowe''s', '158 LOWE''S DRIVE', 'W. Jefferson', 'NC', '28694', 36.385909613627, -81.481582225423, '(336) 846-1829'),
  ('lowes', '1798', 'Wake Forest Lowe''s', '11800 GALAXY DRIVE', 'Wake Forest', 'NC', '27587', 35.965404364794, -78.539123141038, '(919) 554-6420'),
  ('lowes', '0786', 'Washington Lowe''s', '1701 CAROLINA AVENUE', 'Washington', 'NC', '27889', 35.56787553954, -77.06383280748, '(252) 975-1006'),
  ('lowes', '2638', 'Waxhaw Lowe''s', '2508 CUTHBERTSON ROAD', 'Waxhaw', 'NC', '28173', 34.957205136406, -80.755149581925, '(704) 843-8520'),
  ('lowes', '0470', 'Waynesville Lowe''s', '100 LINER COVE ROAD', 'Waynesville', 'NC', '28786', 35.520664546983, -82.957022633759, '(828) 456-9999'),
  ('lowes', '2634', 'Weaverville Lowe''s', '24 NORTHRIDGE COMMONS PARKWAY', 'Weaverville', 'NC', '28787', 35.704366566726, -82.577719474489, '(828) 782-9020'),
  ('lowes', '2869', 'Whiteville Lowe''s', '100 GREEN HILL DRIVE', 'Whiteville', 'NC', '28472', 34.301827461387, -78.716414022612, '(910) 212-9010'),
  ('lowes', '0701', 'Wilkesboro Lowe''s', '2003 W US HIGHWAY 421', 'Wilkesboro', 'NC', '28697', 36.149877824968, -81.203804537395, '(336) 838-1500'),
  ('lowes', '0445', 'University Centre Lowe''s', '354 SOUTH COLLEGE RD.', 'Wilmington', 'NC', '28403', 34.233012651529, -77.875459061825, '(910) 395-8433'),
  ('lowes', '1138', 'S. Wilmington Lowe''s', '5110 S. COLLEGE ROAD', 'Wilmington', 'NC', '28412', 34.1476989792, -77.892498273716, '(910) 397-0137'),
  ('lowes', '2982', 'Porters Neck', '191 PORTERS NECK ROAD', 'Wilmington', 'NC', '28411', 34.301334337231, -77.7902574189, '(910) 319-5000'),
  ('lowes', '0726', 'Wilson Lowe''s', '2501 FOREST HILLS ROAD WEST', 'Wilson', 'NC', '27893', 35.7351195, -77.9550663, '(252) 243-5311'),
  ('lowes', '0436', 'West Winston Lowe''s', '935 HANES MALL BLVD.', 'Winston-salem', 'NC', '27103', 36.064438076202, -80.312092388612, '(336) 768-2400'),
  ('lowes', '0480', 'N. Winston Lowe''s', '5901 UNIVERSITY PKWY.', 'Winston-salem', 'NC', '27105', 36.183351516083, -80.274663372439, '(336) 377-3800'),
  ('lowes', '2653', 'S. Winston-Salem Lowe''s', '1450 LUMBER LANE', 'Winston-salem', 'NC', '27127', 36.031908385959, -80.263949006712, '(336) 784-3460'),
  ('lowes', '0598', 'Greenville Lowe''s', '800 THOMAS LANGSTON RD.', 'Winterville', 'NC', '28590', 35.56089265475, -77.405513785009, '(252) 355-5211')
on conflict (retailer, store_number) do nothing;

-- Demo orders ----------------------------------------------------------------

insert into orders (
  order_number, company_id, retailer, status, requester_name, requester_email,
  materials_subtotal_cents, sizing_fee_cents, mileage_fee_cents, total_cents,
  created_at
)
select
  o.order_number, c.id, o.retailer, o.status, o.requester_name, o.requester_email,
  o.materials_subtotal_cents, o.sizing_fee_cents, o.mileage_fee_cents, o.total_cents,
  now() - o.age
from companies c
cross join (values
  ('#1042', 'homedepot'::retailer, 'delivered'::order_status, 'Dave', 'dave@acme.example.com',
   41280, 2500, 4500, 48280, interval '2 days'),
  ('#1039', 'lowes'::retailer, 'awaiting_customer'::order_status, 'Dave', 'dave@acme.example.com',
   12010, 0, 0, 12010, interval '1 day'),
  ('#1036', 'homedepot'::retailer, 'en_route'::order_status, 'Priya', 'priya@acme.example.com',
   21245, 0, 0, 21245, interval '1 day'),
  ('#1031', 'lowes'::retailer, 'paid'::order_status, 'Dave', 'dave@acme.example.com',
   8720, 0, 0, 8720, interval '5 days')
) as o(order_number, retailer, status, requester_name, requester_email,
       materials_subtotal_cents, sizing_fee_cents, mileage_fee_cents, total_cents, age)
where c.order_alias = 'acme@orders.example.com'
on conflict (order_number) do nothing;

-- Accounts -------------------------------------------------------------------
-- profiles.id references auth.users, so the row cannot exist before the user
-- does. Create each account in the Supabase dashboard (Authentication → Users →
-- Add user, email + password, "Auto Confirm"), then run the matching insert
-- below with that user's id.
--
-- Bootstrap the FIRST dispatcher this way. The admin console cannot promote
-- anyone until a dispatcher already exists, so this one is manual by nature.
-- company_id must be null for a dispatcher — the profiles_customer_company
-- check requires it.
--
-- insert into profiles (id, role, company_id, full_name)
-- values ('<dispatcher-uuid>'::uuid, 'dispatcher', null, 'Dispatch')
-- on conflict (id) do update
--   set role = 'dispatcher', company_id = null, active = true;
--
-- A customer belongs to the seeded company. `do update` rather than
-- `do nothing` so this also fixes a row that was created with the wrong role.
--
-- insert into profiles (id, role, company_id, full_name)
-- values (
--   '<customer-uuid>'::uuid,
--   'customer',
--   (select id from companies where order_alias = 'acme@orders.example.com'),
--   'Acme Portal'
-- )
-- on conflict (id) do update
--   set role = 'customer', active = true;
--
-- After the first dispatcher exists, everyone else is created and assigned
-- from /admin.
