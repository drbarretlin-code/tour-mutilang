const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/App.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

const replacements = [
  // 1. Grande Centre Point Hotel Terminal 21 (Trip.com -> Klook Hotel Page)
  {
    from: 'https://tw.trip.com/hotels/bangkok-hotel-detail-687895/grande-centre-point-hotel-terminal-21/',
    to: 'https://www.klook.com/zh-TW/hotels/detail/210404-grande-centre-point-hotel-terminal-21/'
  },

  // 2. ICONSIAM (Trip.com -> Official Website)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/bangkok/iconsiam-50853765/',
    to: 'https://www.iconsiam.com/zh-tw'
  },

  // 3. Damnoen Saduak (Trip.com -> Klook Activity Page)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/damnoen-saduak/damnoen-saduak-floating-market-81878/',
    to: 'https://www.klook.com/zh-TW/activity/132-damnoen-saduak-floating-market-bangkok/'
  },

  // 4. Maeklong (Trip.com -> Google Maps Search Page)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/samut-songkhram/maeklong-railway-market-10531631/',
    to: 'https://www.google.com/maps/search/?api=1&query=Maeklong+Railway+Market'
  },

  // 5. Cross Pattaya (Trip.com -> Klook Hotel Page)
  {
    from: 'https://tw.trip.com/hotels/pattaya-hotel-detail-38064971/cross-pattaya-oceanphere/',
    to: 'https://www.klook.com/zh-TW/hotels/detail/491953-cross-pattaya-oceanphere/'
  },

  // 6. Kliff Beach Club (Trip.com -> Google Maps Search Page)
  {
    from: 'https://tw.trip.com/travel-guide/restaurant/pattaya/kliff-beach-club-117865239/',
    to: 'https://www.google.com/maps/search/?api=1&query=Kliff+Beach+Club+Pattaya'
  },

  // 7. Suphattra Land (Trip.com -> Klook Activity Page)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/rayong/suphattra-land-10531557/',
    to: 'https://www.klook.com/zh-TW/activity/95015-suphattra-land-orchard-rayong/'
  },

  // 8. Pa Dee Rayong (Trip.com -> Google Maps Search Page)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/rayong/padee-55694248/',
    to: 'https://www.google.com/maps/search/?api=1&query=Pa+Dee+Rayong'
  },

  // 9. One Bangkok (Trip.com -> Official Website)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/bangkok/one-bangkok-145070275/',
    to: 'https://www.onebangkok.com/'
  },

  // 10. Safari World (Trip.com -> Klook Activity Page)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/bangkok/safari-world-75615/',
    to: 'https://www.klook.com/zh-TW/activity/365-safari-world-bangkok/'
  },

  // 11. Platinum Mall (Trip.com -> Google Maps Search Page)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/bangkok/the-platinum-fashion-mall-10531653/',
    to: 'https://www.google.com/maps/search/?api=1&query=The+Platinum+Fashion+Mall'
  },

  // 12. Savoey (Trip.com -> Klook Activity Page)
  {
    from: 'https://tw.trip.com/travel-guide/restaurant/bangkok/savoey-seafood-co-terminal-21-asok-100234151/',
    to: 'https://www.klook.com/zh-TW/activity/9880-savoey-seafood-co-bangkok/'
  },

  // 13. FO SHO BRO (Trip.com -> Google Maps Search Page)
  {
    from: 'https://tw.trip.com/travel-guide/restaurant/bangkok/fo-sho-bro-135894178/',
    to: 'https://www.google.com/maps/search/?api=1&query=FO+SHO+BRO+Bangkok'
  },

  // 14. Chao Phraya River Cruise (Trip.com -> Google Maps Search Page)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/bangkok/chao-phraya-river-75574/',
    to: 'https://www.google.com/maps/search/?api=1&query=Chao+Phraya+River'
  },

  // 15. Columbia Pictures Aquaverse (Trip.com -> Klook Activity Page)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/pattaya/columbia-pictures-aquaverse-135967005/',
    to: 'https://www.klook.com/zh-TW/activity/71542-columbia-pictures-aquaverse-water-park-ticket-pattaya/'
  },

  // 16. Big C (Trip.com -> Google Maps Search Page)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/bangkok/big-c-ratchadamri-10531688/',
    to: 'https://www.google.com/maps/search/?api=1&query=Big+C+Supercenter+Ratchadamri'
  },

  // 17. Let\'s Relax (Trip.com -> Klook Activity Page)
  {
    from: 'https://tw.trip.com/travel-guide/attraction/bangkok/lets-relax-terminal-21-55705351/',
    to: 'https://www.klook.com/zh-TW/activity/1659-lets-relax-spa-treatments-bangkok/'
  }
];

let replacedCount = 0;
for (const replacement of replacements) {
  const escapedFrom = replacement.from.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(escapedFrom, 'g');
  const occurrences = (content.match(regex) || []).length;
  if (occurrences > 0) {
    content = content.replace(regex, replacement.to);
    console.log(`Replaced: ${replacement.from} -> ${replacement.to} (${occurrences} occurrences)`);
    replacedCount += occurrences;
  }
}

if (replacedCount > 0) {
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log(`Successfully completed all updates! Total replacements: ${replacedCount}`);
} else {
  console.log('No matches found. No changes made.');
}
