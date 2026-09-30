const placementMap = {1:10,2:6,3:5,4:4,5:3,6:2,7:1,8:1};

function placementPoints(place) {
  return placementMap[Number(place)] || 0;
}

function calculateTeamScore(place, playerFinishes=[]) {
  const finishes = playerFinishes.reduce((a,b)=>a+Number(b.finishes||0),0);
  const pp = placementPoints(place);
  return { placementPoints:pp, finishPoints:finishes, totalPoints:pp+finishes };
}

module.exports = { placementPoints, calculateTeamScore };
