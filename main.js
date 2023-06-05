// const { json } = require("express");

// const API_KEY = "e06f8937c85fbe26ca6a682282dfc57b";
const API_KEY = "b19be058d19b33f54ad1b4a67d71a812";

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
let selectedCityText;
let selectedCity;


const getCityCoordinates = async (city) => {
    const countryCode = 'IND';
    let response = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${city},${countryCode}&appid=${API_KEY}`);

    const geocodingData = await response.json();
    let [{ lat, lon }] = geocodingData;
    return { lat, lon };
}

const getCitiesByGeocoding = async (searchText) => {
    if (searchText == '') return [];
    let response = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${searchText}&appid=${API_KEY}&limit=5`);

    return response.json();

};

const getCurrentWeatherData = async ({ lat, lon }) => {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
    return response.json();
}


const getHourlyForecasts = async ({ lat, lon }) => {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
    const data = await response.json();
    return data.list.map((hourlyForecast) => {
        let { dt, main: { temp, temp_min, temp_max }, weather: [{ icon, description }] } = hourlyForecast;
        return { dt, temp, temp_min, temp_max, description, icon };
    });
}

const calculateDayWiseForecast = (hourlyForecast) => {
    let dayWiseForecast = new Map();
    for (let { dt, temp_min, temp_max, icon } of hourlyForecast) {
        const dayOftheWeek = WEEKDAYS[new Date(dt * 1000).getDay()];
        if (dayWiseForecast.has(dayOftheWeek)) {
            let forecastData = dayWiseForecast.get(dayOftheWeek);
            forecastData.temp_min = Math.min(forecastData.temp_min, temp_min);
            forecastData.temp_max = Math.max(forecastData.temp_max, temp_max);
        }
        else {
            dayWiseForecast.set(dayOftheWeek, { temp_max, temp_min, icon });
        }
    }
    // console.log(dayWiseForecast);
    return dayWiseForecast;

};

const formatTemp = (temp) => `${temp?.toFixed(1)}ºC`;
const getWeatherIconUrl = (icon) => `https://openweathermap.org/img/wn/${icon}@2x.png`;

const loadCurrentForecast = ({ name, weather: [{ description }], main: { temp, feels_like, temp_min, temp_max, humidity } }) => {
    const currentForecastElement = document.querySelector('#current-forecast');
    currentForecastElement.querySelector('.city').textContent = name;
    currentForecastElement.querySelector('.temp').textContent = formatTemp(temp);
    currentForecastElement.querySelector('.description').textContent = description;
    currentForecastElement.querySelector('.min-max-temp').textContent = `L:${formatTemp(temp_min)} H:${formatTemp(temp_min)}`;

};

const loadHourlyForecast = ({ weather: [{ icon: iconNow, description: descriptionNow }], main: { temp: tempNow } }, hourlyForecasts) => {
    const timeFormatter = Intl.DateTimeFormat("en", {
        hour12: true,
        hour: "numeric",
        // day: "2-digit",
        // month: "2-digit",
        weekday: "short"
    })
    hourlyForecasts = hourlyForecasts.slice(0, 14);
    const hourlyContainer = document.querySelector('#hourly-container');
    let innerHTMLString = `
    <article class="single-hour-forecast">
            <h3 class="time">Now</h3>
            <img class="icon" src="${getWeatherIconUrl(iconNow)}" alt="">
            <p class="description">${descriptionNow}</p>
            <p class="temp">${formatTemp(tempNow)}</p>
        </article>
    `;
    for (let { dt, temp, description, icon } of hourlyForecasts) {
        innerHTMLString += `
        <article class="single-hour-forecast">
            <h3 class="time">${timeFormatter.format(new Date(dt * 1000))}</h3>
            <img class="icon" src="${getWeatherIconUrl(icon)}" alt="">
            <p class="description">${description}</p>
            <p class="temp">${formatTemp(temp)}</p>
        </article>`;
    }
    hourlyContainer.innerHTML = innerHTMLString;
};


const loadFiveDaysForecast = (hourlyForecast) => {
    let dayWiseForecast = calculateDayWiseForecast(hourlyForecast);
    let dayWiseForecastContainer = document.querySelector('#five-days-forecast-container');
    let forecastHTML = '';
    Array.from(dayWiseForecast).map(([day, { temp_max, temp_min, icon }], index) => {
        if (index < 5)
            forecastHTML += `
        <article class="day-wise-forecast">
            <h3 class="day-name">${index == 0 ? 'today' : day}</h3>
            <img src="${getWeatherIconUrl(icon)}" alt="" class="icon">
            <p class="min-temp">${formatTemp(temp_min)}</p>
            <p class="max-temp">${formatTemp(temp_max)}</p>
        </article>`;
    });
    dayWiseForecastContainer.innerHTML = forecastHTML;
};

const loadFeelsLike = ({ main: { feels_like } }) => {
    document.querySelector("#feels-like .temp").textContent = formatTemp(feels_like);
};

const loadHumidity = ({ main: { humidity } }) => {
    document.querySelector("#humidity .humidity-value").textContent = `${humidity} %`;
};



const debounce = (func) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), 1);
    };
}

const onSearch = async (event) => {
    let { value: city } = event.target;
    if (!city) {
        selectedCity = null;
        selectedCityText = '';
    }
    if (!city || city == selectedCityText)
        return
    const cities = await getCitiesByGeocoding(city);
    let options = '';
    for (let { name, lat, lon, country, state } of cities) {
        options += `<option data-city-details='${JSON.stringify({ lat, lon, name })}' value="${name}, ${state}, ${country}"></option>`;
    }
    document.querySelector('#cities').innerHTML = options;
};


const handleCitySelection = (event) => {
    selectedCityText = event.target.value;
    if (!selectedCityText) return;
    let options = document.querySelectorAll('#cities > option');
    if (options.length != 0) {
        let selectedOption = Array.from(options).find((option) => option.value == selectedCityText);
        // console.log(selectedOption);
        if (selectedOption) selectedCity = JSON.parse(selectedOption.getAttribute('data-city-details'));
    }
    // console.log(selectedCity);
    if(selectedCity) loadWeatherData();

};

const loadWeatherData = async () => {
    let currentWeatherData = await getCurrentWeatherData(selectedCity);
    loadCurrentForecast(currentWeatherData);
    let hourlyForecasts = await getHourlyForecasts(selectedCity);
    loadHourlyForecast(currentWeatherData, hourlyForecasts);
    loadFeelsLike(currentWeatherData);
    loadHumidity(currentWeatherData);
    loadFiveDaysForecast(hourlyForecasts);
};


const loadWeatherUsingGeocoding = () => {
    navigator.geolocation.getCurrentPosition(({ coords: { latitude, longitude } }) => {
        selectedCity = { lat: latitude, lon: longitude };
        console.log(selectedCity);
        loadWeatherData();
    })
};

const debouncedSearch = debounce(onSearch);

document.addEventListener('DOMContentLoaded', async () => {
    loadWeatherUsingGeocoding();
    document.querySelector('#search').addEventListener('input', debouncedSearch);
    document.querySelector('#search').addEventListener('change', handleCitySelection)
    // const city = 'Lucknow';
    // let { lat, lon } = await getCityCoordinates(city);
    // let currentWeatherData = await getCurrentWeatherData(lat, lon);
    // loadCurrentForecast(currentWeatherData);
    // let hourlyForecasts = await getHourlyForecasts(lat, lon);
    // loadHourlyForecast(currentWeatherData, hourlyForecasts);
    // loadFeelsLike(currentWeatherData);
    // loadHumidity(currentWeatherData);
    // loadFiveDaysForecast(hourlyForecasts);

});
[]

// http://api.openweathermap.org/geo/1.0/direct?q={city name},{state code},{country code}&limit={limit}&appid={API key}