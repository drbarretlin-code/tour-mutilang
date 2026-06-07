const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/App.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

const replacements = [
  // 1. Terminal 21
  {
    from: 'https://maps.app.goo.gl/Terminal21Asok',
    to: 'https://www.google.com/maps/search/?api=1&query=Terminal+21+Asok'
  },
  {
    from: 'https://maps.app.goo.gl/GrandeCentrePointT21',
    to: 'https://www.google.com/maps/search/?api=1&query=Grande+Centre+Point+Hotel+Terminal+21'
  },
  {
    from: 'https://www.klook.com/zh-TW/hotels/detail/139366-grande-centre-point-hotel-terminal-21/',
    to: 'https://www.klook.com/zh-TW/hotels/detail/210404-grande-centre-point-hotel-terminal-21/'
  },

  // 2. One Bangkok
  {
    from: 'https://maps.app.goo.gl/OneBangkokMap',
    to: 'https://www.google.com/maps/search/?api=1&query=One+Bangkok'
  },
  {
    from: 'https://www.klook.com/zh-TW/blog/one-bangkok-thailand/',
    to: 'https://www.onebangkok.com/'
  },

  // 3. Platinum Mall
  {
    from: 'https://maps.app.goo.gl/PlatinumMall',
    to: 'https://www.google.com/maps/search/?api=1&query=The+Platinum+Fashion+Mall'
  },
  {
    from: 'https://www.klook.com/zh-TW/blog/platinum-fashion-mall-bangkok/',
    to: 'https://www.tripadvisor.com.tw/Attraction_Review-g293916-d621306-Reviews-The_Platinum_Fashion_Mall-Bangkok.html'
  },

  // 4. Iconsiam
  {
    from: 'https://maps.app.goo.gl/IconsiamMap',
    to: 'https://www.google.com/maps/search/?api=1&query=ICONSIAM'
  },

  // 5. River City
  {
    from: 'https://maps.app.goo.gl/RiverCityMap',
    to: 'https://www.google.com/maps/search/?api=1&query=River+City+Bangkok'
  },

  // 6. Suphattra Land
  {
    from: 'https://maps.app.goo.gl/SuphattraLand',
    to: 'https://www.google.com/maps/search/?api=1&query=Suphattra+Land'
  },

  // 7. Pa Dee
  {
    from: 'https://maps.app.goo.gl/PaDeeRayongMap',
    to: 'https://www.google.com/maps/search/?api=1&query=Pa+Dee+Rayong'
  },

  // 8. Cross Pattaya
  {
    from: 'https://maps.app.goo.gl/CrossPattayaMap',
    to: 'https://www.google.com/maps/search/?api=1&query=Cross+Pattaya+Oceanphere'
  },
  {
    from: 'https://www.klook.com/zh-TW/hotels/detail/491953-cross-pattaya-oceanphere/',
    to: 'https://www.agoda.com/zh-tw/cross-pattaya-oceanphere_2/hotel/pattaya-th.html'
  },

  // 9. Aquaverse
  {
    from: 'https://maps.app.goo.gl/AquaverseMap',
    to: 'https://www.google.com/maps/search/?api=1&query=Columbia+Pictures+Aquaverse'
  },

  // 10. Kliff
  {
    from: 'https://maps.app.goo.gl/KliffMap',
    to: 'https://www.google.com/maps/search/?api=1&query=Kliff+Beach+Club+Pattaya'
  },

  // 11. Safari World
  {
    from: 'https://maps.app.goo.gl/SafariWorldMap',
    to: 'https://www.google.com/maps/search/?api=1&query=Safari+World+Bangkok'
  },

  // 12. Savoey
  {
    from: 'https://maps.app.goo.gl/SavoeyMap',
    to: 'https://www.google.com/maps/search/?api=1&query=Savoey+Seafood+Co+Bangkok'
  },

  // 13. Maeklong
  {
    from: 'https://maps.app.goo.gl/MaeklongMap',
    to: 'https://www.google.com/maps/search/?api=1&query=Maeklong+Railway+Market'
  },

  // 14. Big C
  {
    from: 'https://maps.app.goo.gl/BigCMap',
    to: 'https://www.google.com/maps/search/?api=1&query=Big+C+Supercenter+Ratchadamri'
  },

  // 15. Let's Relax
  {
    from: 'https://maps.app.goo.gl/LetsRelaxMap',
    to: 'https://www.google.com/maps/search/?api=1&query=Let%27s+Relax+Spa+Terminal+21'
  },

  // 16. Fo Sho Bro
  {
    from: 'https://maps.app.goo.gl/FoShoBroMap',
    to: 'https://www.google.com/maps/search/?api=1&query=FO+SHO+BRO+Bangkok'
  },

  // 17. Damnoen Saduak (for the configuration)
  {
    from: 'https://maps.app.goo.gl/DamnoenMap',
    to: 'https://www.google.com/maps/search/?api=1&query=Damnoen+Saduak+Floating+Market'
  }
];

let replacedCount = 0;
for (const replacement of replacements) {
  // Use global replacement for each URL
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
