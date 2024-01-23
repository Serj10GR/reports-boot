function getLastMonthInRomanian() {
  // Get the current date
  const currentDate = new Date();
  // Subtract one month from the current date
  currentDate.setMonth(currentDate.getMonth() - 1);

  // Get the name of the last month in Romanian
  const lastMonthName = new Intl.DateTimeFormat('ro-RO', { month: 'long' }).format(currentDate);

  // Get the year of the last month
  const lastMonthYear = currentDate.getFullYear();

  return { 
    month: lastMonthName, 
    year: lastMonthYear,
  }
  ;
}

module.exports = getLastMonthInRomanian;