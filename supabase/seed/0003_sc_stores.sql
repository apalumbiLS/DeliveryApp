-- 0003_sc_stores.sql — South Carolina Lowe's store list
--
-- Reference data every environment needs: the 52 SC Lowe's stores, from
-- External Notes/lowes-sc-stores.json, with each store's page URL and the
-- retailer's own label for it (ADR-0010). Stores only — no demo data — so it
-- can be applied to a deployed environment through the SQL editor.
--
-- Idempotent and corrective: unique on (retailer, store_number), so re-running
-- refreshes the row rather than skipping it. Applied AFTER migrations, never as
-- part of them. See
-- docs/architecture/11-deployment-and-environments.md#database-migrations.

insert into retailer_stores (
  retailer, store_number, name, address_line1, city, state, postal_code,
  lat, lng, phone, store_url, store_label
)
values
  ('lowes', '0639', 'Aiken Lowe''s', '2470 WHISKEY RD.', 'Aiken', 'SC', '29803', 33.507523629325, -81.710665396897, '(803) 641-6565', 'https://www.lowes.com/store/SC-Aiken/0639', 'LOWE''S OF AIKEN, SC'),
  ('lowes', '0728', 'Anderson Lowe''s', '3515 CLEMSON BLVD.', 'Anderson', 'SC', '29621', 34.549583155233, -82.674576582949, '(864) 964-9228', 'https://www.lowes.com/store/SC-Anderson/0728', 'LOWE''S OF ANDERSON, SC'),
  ('lowes', '3050', 'S. Anderson Lowe''s', '408 HIGHWAY 28 BYP', 'Anderson', 'SC', '29626', 34.4836568, -82.662965, '(864) 332-3050', 'https://www.lowes.com/store/SC-Anderson/3050', 'LOWE''S OF S. ANDERSON, SC'),
  ('lowes', '1521', 'Beaufort Lowe''s', '207 ROBERT SMALLS PKWY', 'Beaufort', 'SC', '29906', 32.430012417485, -80.718694426606, '(843) 522-3144', 'https://www.lowes.com/store/SC-Beaufort/1521', 'LOWE''S OF BEAUFORT, SC'),
  ('lowes', '1533', 'Bluffton Lowe''s', '35 MALPHRUS ROAD', 'Bluffton', 'SC', '29910', 32.224322655003, -80.847565468249, '(843) 837-8887', 'https://www.lowes.com/store/SC-Bluffton/1533', 'LOWE''S OF BLUFFTON, SC'),
  ('lowes', '1986', 'Boiling Springs Lowe''s', '170 RAINBOW LAKE ROAD', 'Boiling Springs', 'SC', '29316', 35.050991770688, -81.98421274482, '(864) 573-2771', 'https://www.lowes.com/store/SC-Boiling-Springs/1986', 'LOWE''S OF BOILING SPRINGS, SC'),
  ('lowes', '1751', 'Camden Lowe''s', '11 BAY LANE', 'Camden', 'SC', '29020', 34.248784691272, -80.640611665846, '(803) 572-9000', 'https://www.lowes.com/store/SC-Camden/1751', 'LOWE''S OF CAMDEN, SC'),
  ('lowes', '3071', 'Clemson Lowe''s', '608 ISSAQUEENA TRAIL', 'Central', 'SC', '29630', 34.689971329573, -82.788774380278, '(864) 722-6001', 'https://www.lowes.com/store/SC-Central/3071', 'LOWE''S OF CLEMSON, SC'),
  ('lowes', '0655', 'W. Ashley Lowe''s', '3125 GLENN MCCONNELL PKWY', 'Charleston', 'SC', '29414', 32.811887920808, -80.047611136376, '(843) 852-9099', 'https://www.lowes.com/store/SC-Charleston/0655', 'LOWE''S OF W. ASHLEY, SC'),
  ('lowes', '0661', 'James Island Lowe''s', '770 DANIEL ELLIS DR.', 'Charleston', 'SC', '29412', 32.749672823984, -79.969248451715, '(843) 795-9774', 'https://www.lowes.com/store/SC-Charleston/0661', 'LOWE''S OF JAMES ISLAND, SC'),
  ('lowes', '2920', 'N. York County Lowe''s', '5288 HIGHWAY 557', 'Clover', 'SC', '29710', 35.119637264671, -81.087036174578, '(803) 656-7000', 'https://www.lowes.com/store/SC-Clover/2920', 'LOWE''S OF N. YORK COUNTY, SC'),
  ('lowes', '0385', 'Irmo Lowe''s', '390 HARBISON BLVD.', 'Columbia', 'SC', '29212', 34.07986149286, -81.151049153536, '(803) 749-1272', 'https://www.lowes.com/store/SC-Columbia/0385', 'LOWE''S OF IRMO, SC'),
  ('lowes', '0433', 'N.E. Columbia Lowe''s', '7441 TWO NOTCH ROAD', 'Columbia', 'SC', '29223', 34.071261679723, -80.950341336451, '(803) 865-1000', 'https://www.lowes.com/store/SC-Columbia/0433', 'LOWE''S OF N.E. COLUMBIA, SC'),
  ('lowes', '1064', 'S.E. Columbia Lowe''s', '7420 GARNERS FERRY ROAD', 'Columbia', 'SC', '29209', 33.965374706394, -80.943356101499, '(803) 647-7356', 'https://www.lowes.com/store/SC-Columbia/1064', 'LOWE''S OF SE COLUMBIA, SC'),
  ('lowes', '2356', 'Richland County Lowe''s', '10106 TWO NOTCH ROAD', 'Columbia', 'SC', '29223', 34.115718034897, -80.886244773878, '(803) 699-6000', 'https://www.lowes.com/store/SC-Columbia/2356', 'LOWE''S OF RICHLAND COUNTY, SC'),
  ('lowes', '3026', 'N. Richland County Lowe''s', '1051 SAMS CROSSING DRIVE', 'Columbia', 'SC', '29229', 34.141139164692, -80.94113902662, '(803) 476-1320', 'https://www.lowes.com/store/SC-Columbia/3026', 'LOWE''S OF N. RICHLAND COUNTY, SC'),
  ('lowes', '1705', 'Conway Lowe''s', '2301 E HIGHWAY 501', 'Conway', 'SC', '29526', 33.794413515546, -79.000027003428, '(843) 234-6033', 'https://www.lowes.com/store/SC-Conway/1705', 'LOWE''S OF CONWAY, SC'),
  ('lowes', '0469', 'Easley Lowe''s', '6068 CALHOUN MEM. HWY.', 'Easley', 'SC', '29640', 34.823890594834, -82.577266790934, '(864) 306-6767', 'https://www.lowes.com/store/SC-Easley/0469', 'LOWE''S OF EASLEY, SC'),
  ('lowes', '1075', 'S. Florence Lowe''s', '1701 FREEDOM BLVD', 'Florence', 'SC', '29505', 34.157183679956, -79.757813967344, '(843) 292-0643', 'https://www.lowes.com/store/SC-Florence/1075', 'LOWE''S OF S FLORENCE, SC'),
  ('lowes', '1120', 'Florence Lowe''s', '2301 DAVID H. MCLEOD BLVD.', 'Florence', 'SC', '29501', 34.187408027563, -79.814072096563, '(843) 413-9276', 'https://www.lowes.com/store/SC-Florence/1120', 'LOWE''S OF FLORENCE, SC'),
  ('lowes', '2442', 'Fort Mill Lowe''s', '1640 HIGHWAY 160 WEST', 'Fort Mill', 'SC', '29708', 35.03098906772, -80.967808182517, '(803) 396-5837', 'https://www.lowes.com/store/SC-Fort-Mill/2442', 'LOWE''S OF FORT MILL, SC'),
  ('lowes', '2358', 'Gaffney Lowe''s', '1601 WEST FLOYD BAKER BLVD', 'Gaffney', 'SC', '29341', 35.092463651709, -81.66423110401, '(864) 206-7932', 'https://www.lowes.com/store/SC-Gaffney/2358', 'LOWE''S OF GAFFNEY, SC'),
  ('lowes', '2464', 'Goose Creek Lowe''s', '520 SAINT JAMES AVENUE', 'Goose Creek', 'SC', '29445', 33.030597268798, -80.058843981004, '(843) 820-1070', 'https://www.lowes.com/store/SC-Goose-Creek/2464', 'LOWE''S OF GOOSE CREEK, SC'),
  ('lowes', '1718', 'N.W. Greenville Lowe''s', '1900 POINSETT HIGHWAY', 'Greenville', 'SC', '29609', 34.892921669166, -82.407760766065, '(864) 248-1050', 'https://www.lowes.com/store/SC-Greenville/1718', 'LOWE''S OF N.W. GREENVILLE, SC'),
  ('lowes', '1983', 'Greenville Lowe''s', '1131 WOODRUFF ROAD', 'Greenville', 'SC', '29607', 34.827691076468, -82.300899263338, '(864) 284-3970', 'https://www.lowes.com/store/SC-Greenville/1983', 'LOWE''S OF GREENVILLE, SC'),
  ('lowes', '3640', 'Lowe''s Outlet Greenville', '101 VERDAE BLVD., SUITE 200', 'Greenville', 'SC', '29607', 34.819671025137, -82.339683093443, '(864) 720-6027', 'https://www.lowes.com/store/SC-Greenville/3640', 'LOWE''S OUTLET OF GREENVILLE, SC'),
  ('lowes', '0518', 'Greenwood Lowe''s', '513 BYPASS 72 NW', 'Greenwood', 'SC', '29649', 34.2068243, -82.1887508, '(864) 229-1311', 'https://www.lowes.com/store/SC-Greenwood/0518', 'LOWE''S OF GREENWOOD, SC'),
  ('lowes', '0667', 'Greer Lowe''s', '1370 W WADE HAMPTON BLVD', 'Greer', 'SC', '29650', 34.938827755615, -82.268814192309, '(864) 879-8448', 'https://www.lowes.com/store/SC-Greer/0667', 'LOWE''S OF GREER, SC'),
  ('lowes', '2803', 'Hartsville Lowe''s', '819 SOUTH FOURTH STREET', 'Hartsville', 'SC', '29550', 34.365927902647, -80.065555213162, '(843) 339-2501', 'https://www.lowes.com/store/SC-Hartsville/2803', 'LOWE''S OF HARTSVILLE, SC'),
  ('lowes', '3040', 'N. Lancaster County Lowe''s', '181 FORT MILL HIGHWAY', 'Indian Land', 'SC', '29707', 35.001371037239, -80.85894731575, '(803) 578-4165', 'https://www.lowes.com/store/SC-Indian-Land/3040', 'LOWE''S OF N. LANCASTER, SC'),
  ('lowes', '1066', 'Lexington Lowe''s', '5412 SUNSET BLVD', 'Lexington', 'SC', '29072', 34.000512515275, -81.213130270068, '(803) 358-2000', 'https://www.lowes.com/store/SC-Lexington/1066', 'LOWE''S OF LEXINGTON, SC'),
  ('lowes', '2967', 'S.E. Lexington County Lowe''s', '5570 PLATT SPRINGS ROAD', 'Lexington', 'SC', '29073', 33.908658219546, -81.217350352369, '(803) 808-5460', 'https://www.lowes.com/store/SC-Lexington/2967', 'LOWE''S OF S.E. LEXINGTON COUNTY, SC'),
  ('lowes', '3576', 'Manning', '481 WEST BOYCE STREET', 'Manning', 'SC', '29102', 33.696817553397, -80.222823773243, '(803) 825-3029', 'https://www.lowes.com/store/SC-Manning/3576', 'LOWE''S OF MANNING, SC'),
  ('lowes', '0539', 'MT. Pleasant Lowe''s', '1104 MARKET CENTER BLVD.', 'Mount Pleasant', 'SC', '29464', 32.8265656, -79.8333129, '(843) 881-5757', 'https://www.lowes.com/store/SC-Mount-Pleasant/0539', 'LOWE''S OF MT. PLEASANT, SC'),
  ('lowes', '3317', 'North Mount Pleasant Lowe''s', '3265 NORTH HIGHWAY 17', 'Mount Pleasant', 'SC', '29466', 32.87083852145, -79.777731490472, '(843) 972-6250', 'https://www.lowes.com/store/SC-Mount-Pleasant/3317', 'LOWE''S OF N. MT. PLEASANT, SC'),
  ('lowes', '0410', 'Myrtle Beach Lowe''s', '1160 SEABOARD ST.', 'Myrtle Beach', 'SC', '29577', 33.714503269022, -78.894610521326, '(843) 626-1700', 'https://www.lowes.com/store/SC-Myrtle-Beach/0410', 'LOWE''S OF MYRTLE BEACH, SC'),
  ('lowes', '1004', 'Surfside Lowe''s', '8672 HIGHWAY 17 BYP S', 'Myrtle Beach', 'SC', '29588', 33.6464345, -78.987223, '(843) 650-1400', 'https://www.lowes.com/store/SC-Myrtle-Beach/1004', 'LOWE''S OF SURFSIDE, SC'),
  ('lowes', '2520', 'Newberry Lowe''s', '2911 MAIN STREET', 'Newberry', 'SC', '29108', 34.284612, -81.5899329, '(803) 405-7061', 'https://www.lowes.com/store/SC-Newberry/2520', 'LOWE''S OF NEWBERRY, SC'),
  ('lowes', '2207', 'N. Augusta Lowe''s', '1220 KNOX AVENUE', 'North Augusta', 'SC', '29841', 33.502403202972, -81.959372537192, '(803) 442-4140', 'https://www.lowes.com/store/SC-North-Augusta/2207', 'LOWE''S OF N. AUGUSTA, SC'),
  ('lowes', '0497', 'North Charleston Lowe''s', '7555 NORTHWOOD BLVD.', 'North Charleston', 'SC', '29406', 32.938237389933, -80.046027336443, '(843) 572-4613', 'https://www.lowes.com/store/SC-North-Charleston/0497', 'LOWE''S OF N. CHARLESTON, SC'),
  ('lowes', '0603', 'North Myrtle Beach Lowe''s', '214 U.S. HWY. #17 NORTH', 'North Myrtle Beach', 'SC', '29582', 33.830036543616, -78.677575751342, '(843) 280-5182', 'https://www.lowes.com/store/SC-North-Myrtle-Beach/0603', 'LOWE''S OF N MYRTLE BEACH, SC'),
  ('lowes', '0559', 'Orangeburg Lowe''s', '2896 NORTH ROAD HWY 178', 'Orangeburg', 'SC', '29118', 33.528246874275, -80.891855619741, '(803) 516-8488', 'https://www.lowes.com/store/SC-Orangeburg/0559', 'LOWE''S OF ORANGEBURG, SC'),
  ('lowes', '0416', 'Rock Hill Lowe''s', '1350 SPRINGDALE ROAD', 'Rock Hill', 'SC', '29730', 34.938310535616, -80.963448008097, '(803) 324-3170', 'https://www.lowes.com/store/SC-Rock-Hill/0416', 'LOWE''S OF ROCK HILL, SC'),
  ('lowes', '1635', 'Seneca Lowe''s', '195 BILO PLACE', 'Seneca', 'SC', '29678', 34.6891887, -82.9845402, '(864) 882-0218', 'https://www.lowes.com/store/SC-Seneca/1635', 'LOWE''S OF SENECA, SC'),
  ('lowes', '0528', 'Simpsonville Lowe''s', '3958 GRANDVIEW DRIVE', 'Simpsonville', 'SC', '29680', 34.713741185071, -82.250215208874, '(864) 962-0671', 'https://www.lowes.com/store/SC-Simpsonville/0528', 'LOWE''S OF SIMPSONVILLE, SC'),
  ('lowes', '2548', 'E. Spartanburg Lowe''s', '2079 EAST MAIN STREET', 'Spartanburg', 'SC', '29307', 34.973584337611, -81.881937736342, '(864) 596-4770', 'https://www.lowes.com/store/SC-Spartanburg/2548', 'LOWE''S OF E. SPARTANBURG, SC'),
  ('lowes', '2595', 'Spartanburg Lowe''s', '120 E. BLACKSTOCK ROAD', 'Spartanburg', 'SC', '29301', 34.921770111452, -81.98677722629, '(864) 216-4934', 'https://www.lowes.com/store/SC-Spartanburg/2595', 'LOWE''S OF SPARTANBURG, SC'),
  ('lowes', '0358', 'Summerville Lowe''s', '1207 N. MAIN ST.', 'Summerville', 'SC', '29483', 33.035038231214, -80.159031236217, '(843) 851-0066', 'https://www.lowes.com/store/SC-Summerville/0358', 'LOWE''S OF SUMMERVILLE, SC'),
  ('lowes', '2948', 'N.W. Charleston Lowe''s', '9600 DORCHESTER ROAD', 'Summerville', 'SC', '29485', 32.93642901067, -80.143398141335, '(843) 486-4130', 'https://www.lowes.com/store/SC-Summerville/2948', 'LOWE''S OF N.W. CHARLESTON, SC'),
  ('lowes', '0626', 'Sumter Lowe''s', '1251 BROAD STREET', 'Sumter', 'SC', '29150', 33.956862100832, -80.386185421219, '(803) 905-2650', 'https://www.lowes.com/store/SC-Sumter/0626', 'LOWE''S OF SUMTER, SC'),
  ('lowes', '0499', 'West Columbia Lowe''s', '2829 AUGUSTA RD', 'West Columbia', 'SC', '29170', 33.979594051961, -81.111839709546, '(803) 926-8885', 'https://www.lowes.com/store/SC-West-Columbia/0499', 'LOWE''S OF WEST COLUMBIA, SC'),
  ('lowes', '1776', 'York Lowe''s', '1010 EAST LIBERTY ST', 'York', 'SC', '29745', 34.985361873156, -81.212232694313, '(803) 684-1548', 'https://www.lowes.com/store/SC-York/1776', 'LOWE''S OF YORK, SC')
on conflict (retailer, store_number) do update
  set name = excluded.name,
      address_line1 = excluded.address_line1,
      city = excluded.city,
      state = excluded.state,
      postal_code = excluded.postal_code,
      lat = excluded.lat,
      lng = excluded.lng,
      phone = excluded.phone,
      store_url = excluded.store_url,
      store_label = excluded.store_label;
