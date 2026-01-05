# BlitzPrices Scrape Commands by Category

Set **Record limit** in UI before running each command.

---

## PLUMBING
**91 keywords** × 25 record limit = **~2,275 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "50 gallon water heater"}, {"keyword": "40 gallon water heater"}, {"keyword": "tankless water heater"}, {"keyword": "gas water heater"}, {"keyword": "electric water heater"}, {"keyword": "water heater thermostat"}, {"keyword": "water heater element"}, {"keyword": "water heater anode rod"}, {"keyword": "water heater pan"}, {"keyword": "expansion tank"}, {"keyword": "copper pipe 1/2"}, {"keyword": "copper pipe 3/4"}, {"keyword": "copper pipe 1 inch"}, {"keyword": "copper fitting"}, {"keyword": "copper elbow"}, {"keyword": "copper tee"}, {"keyword": "copper coupling"}, {"keyword": "shark bite fitting"}, {"keyword": "pex pipe"}, {"keyword": "pex fitting"}, {"keyword": "pex crimp ring"}, {"keyword": "pex manifold"}, {"keyword": "cpvc pipe"}, {"keyword": "cpvc fitting"}, {"keyword": "pvc pipe"}, {"keyword": "pvc fitting"}, {"keyword": "pvc elbow"}, {"keyword": "pvc tee"}, {"keyword": "pvc coupling"}, {"keyword": "pvc cement"}, {"keyword": "abs pipe"}, {"keyword": "abs fitting"}, {"keyword": "toilet"}, {"keyword": "toilet flange"}, {"keyword": "toilet wax ring"}, {"keyword": "toilet fill valve"}, {"keyword": "toilet flapper"}, {"keyword": "toilet seat"}, {"keyword": "toilet supply line"}, {"keyword": "bidet"}, {"keyword": "bathroom faucet"}, {"keyword": "kitchen faucet"}, {"keyword": "shower faucet"}, {"keyword": "bathtub faucet"}, {"keyword": "faucet cartridge"}, {"keyword": "faucet aerator"}, {"keyword": "bathroom sink"}, {"keyword": "kitchen sink"}, {"keyword": "utility sink"}, {"keyword": "sink strainer"}, {"keyword": "sink drain"}, {"keyword": "garbage disposal"}, {"keyword": "dishwasher connector"}, {"keyword": "p trap"}, {"keyword": "sink tailpiece"}, {"keyword": "supply line"}, {"keyword": "braided supply line"}, {"keyword": "shut off valve"}, {"keyword": "ball valve"}, {"keyword": "gate valve"}, {"keyword": "check valve"}, {"keyword": "pressure reducing valve"}, {"keyword": "mixing valve"}, {"keyword": "shower valve"}, {"keyword": "sump pump"}, {"keyword": "sewage pump"}, {"keyword": "well pump"}, {"keyword": "recirculating pump"}, {"keyword": "water softener"}, {"keyword": "whole house filter"}, {"keyword": "gas flex line"}, {"keyword": "gas valve"}, {"keyword": "gas shut off"}, {"keyword": "water meter"}, {"keyword": "backflow preventer"}, {"keyword": "hose bib"}, {"keyword": "outdoor faucet"}, {"keyword": "shower head"}, {"keyword": "shower arm"}, {"keyword": "shower drain"}, {"keyword": "bathtub drain"}, {"keyword": "overflow drain"}, {"keyword": "floor drain"}, {"keyword": "cleanout plug"}, {"keyword": "pipe strap"}, {"keyword": "pipe hanger"}, {"keyword": "pipe insulation"}, {"keyword": "pipe thread tape"}, {"keyword": "plumber putty"}, {"keyword": "solder"}, {"keyword": "flux"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## ELECTRICAL
**89 keywords** × 25 record limit = **~2,225 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "circuit breaker 15 amp"}, {"keyword": "circuit breaker 20 amp"}, {"keyword": "circuit breaker 30 amp"}, {"keyword": "circuit breaker 50 amp"}, {"keyword": "circuit breaker 100 amp"}, {"keyword": "circuit breaker 200 amp"}, {"keyword": "gfci breaker"}, {"keyword": "afci breaker"}, {"keyword": "main breaker panel"}, {"keyword": "subpanel"}, {"keyword": "load center"}, {"keyword": "breaker box"}, {"keyword": "meter socket"}, {"keyword": "electrical panel cover"}, {"keyword": "romex 14/2"}, {"keyword": "romex 12/2"}, {"keyword": "romex 10/2"}, {"keyword": "romex 10/3"}, {"keyword": "romex 6/3"}, {"keyword": "thhn wire"}, {"keyword": "uf cable"}, {"keyword": "ser cable"}, {"keyword": "electrical wire 14 gauge"}, {"keyword": "electrical wire 12 gauge"}, {"keyword": "electrical wire 10 gauge"}, {"keyword": "electrical wire 8 gauge"}, {"keyword": "electrical wire 6 gauge"}, {"keyword": "ground wire"}, {"keyword": "outlet 15 amp"}, {"keyword": "outlet 20 amp"}, {"keyword": "gfci outlet"}, {"keyword": "usb outlet"}, {"keyword": "outdoor outlet"}, {"keyword": "dryer outlet"}, {"keyword": "range outlet"}, {"keyword": "outlet cover"}, {"keyword": "outlet box"}, {"keyword": "light switch"}, {"keyword": "dimmer switch"}, {"keyword": "3 way switch"}, {"keyword": "4 way switch"}, {"keyword": "smart switch"}, {"keyword": "switch plate"}, {"keyword": "junction box"}, {"keyword": "electrical box"}, {"keyword": "old work box"}, {"keyword": "new work box"}, {"keyword": "weatherproof box"}, {"keyword": "conduit 1/2"}, {"keyword": "conduit 3/4"}, {"keyword": "conduit 1 inch"}, {"keyword": "emt conduit"}, {"keyword": "pvc conduit"}, {"keyword": "conduit fitting"}, {"keyword": "conduit connector"}, {"keyword": "conduit elbow"}, {"keyword": "wire nut"}, {"keyword": "push in connector"}, {"keyword": "wire staple"}, {"keyword": "cable clamp"}, {"keyword": "ground rod"}, {"keyword": "ground clamp"}, {"keyword": "grounding bar"}, {"keyword": "neutral bar"}, {"keyword": "electrical tape"}, {"keyword": "fish tape"}, {"keyword": "wire stripper"}, {"keyword": "voltage tester"}, {"keyword": "multimeter"}, {"keyword": "ceiling fan box"}, {"keyword": "recessed light"}, {"keyword": "can light"}, {"keyword": "led downlight"}, {"keyword": "track lighting"}, {"keyword": "under cabinet light"}, {"keyword": "flood light"}, {"keyword": "motion sensor light"}, {"keyword": "wall sconce"}, {"keyword": "pendant light"}, {"keyword": "ceiling light"}, {"keyword": "ceiling fan"}, {"keyword": "bathroom exhaust fan"}, {"keyword": "whole house fan"}, {"keyword": "attic fan"}, {"keyword": "doorbell"}, {"keyword": "doorbell transformer"}, {"keyword": "smoke detector"}, {"keyword": "carbon monoxide detector"}, {"keyword": "surge protector whole house"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## HARDWARE
**47 keywords** × 30 record limit = **~1,410 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "wood screws"}, {"keyword": "drywall screws"}, {"keyword": "deck screws"}, {"keyword": "concrete screws"}, {"keyword": "lag bolts"}, {"keyword": "carriage bolts"}, {"keyword": "machine screws"}, {"keyword": "sheet metal screws"}, {"keyword": "self tapping screws"}, {"keyword": "finish nails"}, {"keyword": "brad nails"}, {"keyword": "framing nails"}, {"keyword": "roofing nails"}, {"keyword": "concrete nails"}, {"keyword": "nail gun"}, {"keyword": "staple gun"}, {"keyword": "staples"}, {"keyword": "nuts and bolts"}, {"keyword": "washers"}, {"keyword": "lock washers"}, {"keyword": "anchor bolts"}, {"keyword": "wedge anchor"}, {"keyword": "toggle bolt"}, {"keyword": "wall anchor"}, {"keyword": "hollow wall anchor"}, {"keyword": "door hinge"}, {"keyword": "cabinet hinge"}, {"keyword": "piano hinge"}, {"keyword": "door knob"}, {"keyword": "door lever"}, {"keyword": "deadbolt"}, {"keyword": "door lock"}, {"keyword": "cabinet knob"}, {"keyword": "cabinet pull"}, {"keyword": "drawer slide"}, {"keyword": "shelf bracket"}, {"keyword": "angle bracket"}, {"keyword": "mending plate"}, {"keyword": "joist hanger"}, {"keyword": "hurricane tie"}, {"keyword": "post base"}, {"keyword": "chain"}, {"keyword": "wire rope"}, {"keyword": "rope"}, {"keyword": "bungee cord"}, {"keyword": "zip ties"}, {"keyword": "duct strap"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## HVAC
**56 keywords** × 20 record limit = **~1,120 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "furnace filter"}, {"keyword": "air filter 16x25x1"}, {"keyword": "air filter 20x20x1"}, {"keyword": "air filter 20x25x1"}, {"keyword": "pleated filter"}, {"keyword": "hepa filter"}, {"keyword": "thermostat"}, {"keyword": "smart thermostat"}, {"keyword": "programmable thermostat"}, {"keyword": "thermostat wire"}, {"keyword": "condensate pump"}, {"keyword": "condensate drain line"}, {"keyword": "hvac tape"}, {"keyword": "foil tape"}, {"keyword": "duct tape"}, {"keyword": "flex duct"}, {"keyword": "rigid duct"}, {"keyword": "duct connector"}, {"keyword": "duct elbow"}, {"keyword": "register"}, {"keyword": "floor register"}, {"keyword": "ceiling register"}, {"keyword": "return air grille"}, {"keyword": "vent cover"}, {"keyword": "dryer vent"}, {"keyword": "dryer vent hose"}, {"keyword": "range hood vent"}, {"keyword": "bathroom vent"}, {"keyword": "refrigerant"}, {"keyword": "r410a refrigerant"}, {"keyword": "ac capacitor"}, {"keyword": "ac contactor"}, {"keyword": "condenser fan motor"}, {"keyword": "blower motor"}, {"keyword": "inducer motor"}, {"keyword": "ignitor furnace"}, {"keyword": "flame sensor"}, {"keyword": "gas valve furnace"}, {"keyword": "heat exchanger"}, {"keyword": "evaporator coil"}, {"keyword": "condenser coil"}, {"keyword": "line set"}, {"keyword": "copper line set"}, {"keyword": "mini split"}, {"keyword": "window ac unit"}, {"keyword": "portable ac"}, {"keyword": "space heater"}, {"keyword": "baseboard heater"}, {"keyword": "wall heater"}, {"keyword": "garage heater"}, {"keyword": "radiant heater"}, {"keyword": "heat pump"}, {"keyword": "humidifier"}, {"keyword": "dehumidifier"}, {"keyword": "air purifier"}, {"keyword": "uv light hvac"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## PAINT
**43 keywords** × 15 record limit = **~645 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "interior paint gallon"}, {"keyword": "exterior paint gallon"}, {"keyword": "ceiling paint"}, {"keyword": "primer"}, {"keyword": "paint primer"}, {"keyword": "kilz primer"}, {"keyword": "stain blocking primer"}, {"keyword": "wood stain"}, {"keyword": "deck stain"}, {"keyword": "concrete stain"}, {"keyword": "polyurethane"}, {"keyword": "lacquer"}, {"keyword": "shellac"}, {"keyword": "wood finish"}, {"keyword": "paint brush"}, {"keyword": "paint roller"}, {"keyword": "roller cover"}, {"keyword": "paint tray"}, {"keyword": "paint sprayer"}, {"keyword": "spray paint"}, {"keyword": "painters tape"}, {"keyword": "masking tape"}, {"keyword": "drop cloth"}, {"keyword": "plastic sheeting"}, {"keyword": "paint thinner"}, {"keyword": "mineral spirits"}, {"keyword": "denatured alcohol"}, {"keyword": "acetone"}, {"keyword": "paint stripper"}, {"keyword": "spackle"}, {"keyword": "joint compound"}, {"keyword": "drywall mud"}, {"keyword": "wood filler"}, {"keyword": "wood putty"}, {"keyword": "caulk"}, {"keyword": "silicone caulk"}, {"keyword": "painters caulk"}, {"keyword": "caulk gun"}, {"keyword": "sandpaper"}, {"keyword": "sanding block"}, {"keyword": "paint scraper"}, {"keyword": "putty knife"}, {"keyword": "5 in 1 tool"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## FLOORING
**34 keywords** × 20 record limit = **~680 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "laminate flooring"}, {"keyword": "vinyl plank flooring"}, {"keyword": "lvp flooring"}, {"keyword": "hardwood flooring"}, {"keyword": "engineered hardwood"}, {"keyword": "tile flooring"}, {"keyword": "ceramic tile"}, {"keyword": "porcelain tile"}, {"keyword": "floor tile"}, {"keyword": "wall tile"}, {"keyword": "subway tile"}, {"keyword": "mosaic tile"}, {"keyword": "tile spacer"}, {"keyword": "tile adhesive"}, {"keyword": "thinset mortar"}, {"keyword": "grout"}, {"keyword": "grout sealer"}, {"keyword": "tile cutter"}, {"keyword": "tile saw blade"}, {"keyword": "carpet"}, {"keyword": "carpet pad"}, {"keyword": "carpet tack strip"}, {"keyword": "carpet transition"}, {"keyword": "floor transition"}, {"keyword": "threshold"}, {"keyword": "underlayment"}, {"keyword": "floor leveler"}, {"keyword": "concrete sealer"}, {"keyword": "epoxy floor"}, {"keyword": "garage floor paint"}, {"keyword": "baseboard"}, {"keyword": "quarter round"}, {"keyword": "shoe molding"}, {"keyword": "floor vent"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## DRYWALL
**23 keywords** × 15 record limit = **~345 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "drywall sheet"}, {"keyword": "drywall 1/2"}, {"keyword": "drywall 5/8"}, {"keyword": "moisture resistant drywall"}, {"keyword": "fire rated drywall"}, {"keyword": "cement board"}, {"keyword": "backer board"}, {"keyword": "drywall tape"}, {"keyword": "mesh tape"}, {"keyword": "paper tape"}, {"keyword": "drywall screws"}, {"keyword": "drywall anchors"}, {"keyword": "corner bead"}, {"keyword": "j bead"}, {"keyword": "drywall knife"}, {"keyword": "taping knife"}, {"keyword": "mud pan"}, {"keyword": "drywall sander"}, {"keyword": "texture spray"}, {"keyword": "popcorn ceiling"}, {"keyword": "acoustic ceiling tile"}, {"keyword": "drop ceiling"}, {"keyword": "ceiling grid"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## ROOFING
**23 keywords** × 20 record limit = **~460 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "roofing shingles"}, {"keyword": "roof shingles"}, {"keyword": "architectural shingles"}, {"keyword": "3 tab shingles"}, {"keyword": "metal roofing"}, {"keyword": "roof underlayment"}, {"keyword": "roofing felt"}, {"keyword": "ice and water shield"}, {"keyword": "roof flashing"}, {"keyword": "step flashing"}, {"keyword": "drip edge"}, {"keyword": "roof vent"}, {"keyword": "ridge vent"}, {"keyword": "roof boot"}, {"keyword": "roofing nails"}, {"keyword": "roofing tar"}, {"keyword": "roof sealant"}, {"keyword": "roof cement"}, {"keyword": "gutter"}, {"keyword": "downspout"}, {"keyword": "gutter guard"}, {"keyword": "soffit"}, {"keyword": "fascia"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## LUMBER
**21 keywords** × 10 record limit = **~210 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "2x4 lumber"}, {"keyword": "2x6 lumber"}, {"keyword": "2x8 lumber"}, {"keyword": "2x10 lumber"}, {"keyword": "2x12 lumber"}, {"keyword": "4x4 post"}, {"keyword": "6x6 post"}, {"keyword": "plywood"}, {"keyword": "osb board"}, {"keyword": "mdf board"}, {"keyword": "particle board"}, {"keyword": "furring strip"}, {"keyword": "lattice"}, {"keyword": "deck board"}, {"keyword": "composite decking"}, {"keyword": "pressure treated lumber"}, {"keyword": "cedar lumber"}, {"keyword": "fence picket"}, {"keyword": "fence post"}, {"keyword": "fence panel"}, {"keyword": "gate hardware"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## DOORS
**18 keywords** × 15 record limit = **~270 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "interior door"}, {"keyword": "exterior door"}, {"keyword": "storm door"}, {"keyword": "screen door"}, {"keyword": "door frame"}, {"keyword": "door jamb"}, {"keyword": "door casing"}, {"keyword": "door threshold"}, {"keyword": "door sweep"}, {"keyword": "door weatherstrip"}, {"keyword": "door closer"}, {"keyword": "door stop"}, {"keyword": "pocket door"}, {"keyword": "bifold door"}, {"keyword": "sliding door"}, {"keyword": "garage door"}, {"keyword": "garage door opener"}, {"keyword": "garage door spring"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## WINDOWS
**10 keywords** × 10 record limit = **~100 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "window"}, {"keyword": "vinyl window"}, {"keyword": "window screen"}, {"keyword": "window glass"}, {"keyword": "window film"}, {"keyword": "window insulation"}, {"keyword": "weatherstripping"}, {"keyword": "window caulk"}, {"keyword": "window lock"}, {"keyword": "window hardware"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## OUTDOOR
**18 keywords** × 15 record limit = **~270 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "sprinkler head"}, {"keyword": "sprinkler valve"}, {"keyword": "irrigation pipe"}, {"keyword": "drip irrigation"}, {"keyword": "garden hose"}, {"keyword": "hose connector"}, {"keyword": "spigot"}, {"keyword": "outdoor faucet"}, {"keyword": "landscape lighting"}, {"keyword": "solar lights"}, {"keyword": "deck post"}, {"keyword": "post cap"}, {"keyword": "concrete mix"}, {"keyword": "quikrete"}, {"keyword": "mortar mix"}, {"keyword": "paver"}, {"keyword": "retaining wall block"}, {"keyword": "landscape fabric"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## TOOLS
**19 keywords** × 10 record limit = **~190 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "drill bit set"}, {"keyword": "hole saw"}, {"keyword": "spade bit"}, {"keyword": "auger bit"}, {"keyword": "masonry bit"}, {"keyword": "saw blade"}, {"keyword": "circular saw blade"}, {"keyword": "reciprocating saw blade"}, {"keyword": "jigsaw blade"}, {"keyword": "oscillating blade"}, {"keyword": "grinding wheel"}, {"keyword": "cut off wheel"}, {"keyword": "sanding disc"}, {"keyword": "wire brush"}, {"keyword": "work gloves"}, {"keyword": "safety glasses"}, {"keyword": "ear protection"}, {"keyword": "dust mask"}, {"keyword": "respirator"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## APPLIANCES
**10 keywords** × 10 record limit = **~100 items max**

```bash
curl -H "Authorization: Bearer ff1414a1-6490-45d2-8ed0-be9dc32c9124" -H "Content-Type: application/json" -d '{"input": [{"keyword": "refrigerator"}, {"keyword": "dishwasher"}, {"keyword": "microwave"}, {"keyword": "range hood"}, {"keyword": "garbage disposal"}, {"keyword": "ice maker"}, {"keyword": "water filter refrigerator"}, {"keyword": "dryer vent"}, {"keyword": "washing machine hose"}, {"keyword": "appliance cord"}]}' "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lmusivh019i7g97q2n&notify=false&include_errors=true&type=discover_new&discover_by=keyword"
```

---

## SUMMARY

| Category | Keywords | Limit | Max Items |
|----------|----------|-------|-----------|
| Plumbing | 91 | 25 | 2,275 |
| Electrical | 89 | 25 | 2,225 |
| Hardware | 47 | 30 | 1,410 |
| HVAC | 56 | 20 | 1,120 |
| Paint | 43 | 15 | 645 |
| Flooring | 34 | 20 | 680 |
| Drywall | 23 | 15 | 345 |
| Roofing | 23 | 20 | 460 |
| Lumber | 21 | 10 | 210 |
| Doors | 18 | 15 | 270 |
| Windows | 10 | 10 | 100 |
| Outdoor | 18 | 15 | 270 |
| Tools | 19 | 10 | 190 |
| Appliances | 10 | 10 | 100 |
| **TOTAL** | **502** | | **~10,300** |

**Estimated total cost: ~$15.45**