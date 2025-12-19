// 1) 都市名→緯度経度（Geocoding）
// 2) 緯度経度→日別予報（start_date/end_date）

//都市名から緯度経度を取得
async function geocodeCity(city) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ja&format=json`;
    const res = await fetch(url);

    if (res.ok === false) {
        throw new Error("都市検索に失敗しました");
    }

    const data = await res.json();

    const results = data.results;
    const noResults = !results || results.length === 0;

    if (noResults) {
        throw new Error("都市が見つかりませんでした");
    }

    const first = results[0];
    return first;

}

// 緯度経度・期間から天気予報を取得
async function fetchForecast(lat, lon, from, to) {
    const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum` +
        `&hourly=snow_depth` +
        `&timezone=Asia%2FTokyo` +
        `&start_date=${from}&end_date=${to}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("天気取得に失敗しました");
    return await res.json();
}

// hourly snow_depth(m) を「日別 最大(cm)」に変換
function buildDailySnowDepthMaxCm(hourly) {
    const map = {}; 
    if (!hourly || !hourly.time || !hourly.snow_depth) return map;

    for (let i = 0; i < hourly.time.length; i++) {
        const t = hourly.time[i];              // "YYYY-MM-DDTHH:MM"
        const day = String(t).slice(0, 10);    // "YYYY-MM-DD"
        const depthM = Number(hourly.snow_depth[i]);

        if (!Number.isFinite(depthM)) continue;
        const depthCm = depthM * 100;

        if (map[day] == null || depthCm > map[day]) map[day] = depthCm;
    }
    return map;
}


function renderTable(daily, snowDepthMaxCmByDay) {
    const $tbody = $("#dailyTable tbody");
    $tbody.empty();

    const time = daily.time || [];
    const tmax = daily.temperature_2m_max || [];
    const tmin = daily.temperature_2m_min || [];
    const prcp = daily.precipitation_sum || [];
    const snow = daily.snowfall_sum || []; // cm

    for (let i = 0; i < time.length; i++) {
        const day = time[i];
        const depthMaxCm = snowDepthMaxCmByDay[day];

        $tbody.append(
        `
        <tr>
        <td>${day}</td>
        <td>${tmax[i] ?? ""}</td>. //??→0だった場合空文字にする
        <td>${tmin[i] ?? ""}</td>
        <td>${prcp[i] ?? ""}</td>
        <td>${snow[i] ?? ""}</td>
        <td>${depthMaxCm == null ? "" : depthMaxCm.toFixed(1)}</td>
        </tr>
        `
        );
    }
}

$("#loadBtn").on("click", async function () {
    try {
        const city = $("#city").val().trim();
        const from = $("#from").val();
        const to = $("#to").val();

        if (!city) { alert("都市名を入れてね"); return; }
        if (!from || !to) { alert("開始日・終了日を入れてね"); return; }
        if (from > to) { alert("開始日は終了日より前にしてね"); return; }

        $("#loadBtn").prop("disabled", true).text("取得中...");  //true=押せない、false=押せる（ボタン要素に使用できる）

        const place = await geocodeCity(city);
        const data = await fetchForecast(place.latitude, place.longitude, from, to);

        if (!data.daily) throw new Error("dailyが取得できませんでした（期間/都市を確認）");

        const snowDepthMaxCmByDay = buildDailySnowDepthMaxCm(data.hourly);
        renderTable(data.daily, snowDepthMaxCmByDay);

    } catch (err) {
        alert(err.message || "エラーが発生しました");
    } finally {
        $("#loadBtn").prop("disabled", false)
        $("#loadBtn").text("表示");
    }
});


// 今日の日付を "YYYY-MM-DD" 形式で取得
function ymdToday() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// 初期値設定
$(function () {
    $("#from").val(ymdToday());
    $("#to").val(ymdToday());
    $("#city").val("東京");
});