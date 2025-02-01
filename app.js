// Shuffle the video sources to randomize the order.
const videoSources = shuffleArray([
    "bafybeigtfhi5ws6lrveafsnwsryzwundiqal3iiwpo3ytmoxgv5hsp7mou",
    "bafybeic7y4a4334bvkj4qjzx7gjodlkca33kfycvr7esicm23efroidgfu",
    "bafybeidcjv6gk54s77rnocd3evbxdm26p2cyolhihpqxp366oj2ztaeltq",
    "bafybeicprruiaudtfmg4kg2zcr45776x5da77zv73owooppw3o2ctfdt5e",
    "bafybeidl2t566mip6tsmx2lbfxiydbvcdglq5qnkpdvrkje2uqxyf6rjom",
    "bafybeibvmhfd4mnnyqv2zf3l22wndpzrgoficslxxtktmhdpbtzq72wm3u",
    "bafybeicqxewkc5btmz44bdc6spe3s4yrfpjzuhbga2y6vydnsib4z3lsgq",
    "bafybeiboxgm6xlz5arh6lhzbpowc6gtscshrwsnj6dkrffzuqpk7n3an4q",
    "bafybeieadukgtpiyyo46xje34hmd3k4nyqphihi3uuvntrkvjjliqbixze",
    "bafybeicwq3gxtay7xgc7dxfd3oda5o6ypebyrrav5sm7w4blqt5pdl4fbi",
    "bafybeidcpcb3ksqsomth3dyumfa6umdhye7cre75sn6jl2fyba5tymapl4",
    "bafybeichqv6feek6txormpcxenwnsnv3gswohyp3zc4zlrnyxg5bavnmim",
    "bafybeigm5vud4d6jvsma2kgcgw3phjoimvrwdyisjoxezh4qj7kff2vf24",
    "bafybeid6hz6f3yokuzo3cdotvck4d43avol3pfw3wccx6bzprpch5hvvwu",
    "bafybeidkpopiwmpxkilx4llay354dpqdndqzv7pzc6oyffziolskdfftfm",
    "bafybeifrh25cck2yue5yeesdzqlfh3p7mz7e7vkvfini5vdjtjosq7epxi",
    "bafybeigqvv5fjoi2jpyvhpxzqcuadd2fpqio56sukmcckig6di2tg7rv7q",
    "bafybeifkoazphnc4fzeaf6b6wnhbvuscsbvj54tn5h565alhm2mjdtedii",
    "bafybeicqw4jgftp3rnmke2ixvb3auukeaauymj6y3g4b552sxvvf6adygm",
    "bafybeie2y67hpmxoxpxkdez3veezjj6rchn4vi5ckoy7ngysn34w3h34w4",
    "bafybeiczqttpr664lwktlcmrzvwr6oeemwn5howixjxynkorapjw7t7jze",
    "bafybeidcddfku264l3gqb4sdi3qwyrbrwulzg5qpbpvfpslbkyqwl5p2yy",
    "bafybeihiwcl42ukgcn3e3pszu46da2fbnn2xatyjqofyyeahfgu362wysq",
    "bafybeia7kqdwptsbetoj4gy5a73lohyuokudurijzmarq247uzveiegenu",
    "bafybeigdpqir5ehfqyuhmctcwkxoqchhbbrrgp6aj76pb3y7b2ot4mm4dq",
    "bafybeihb27cory76wmbm3n5gwuu2yiluyuuhpomot54gsfdszewix7eycm",
    "bafybeibob3v7y7aiuzksield65oybwtvhraorte34i5hqknmkdoxv4klae",
    "bafybeigdqsp2qfsf7cmhqjw72qt4wjrhr5irp637wyeiyd3jp75uyeq6ey",
    "bafybeihjurlpa2ztfy7cia6fxr7cj225rojhxapuj2rtvkruot7skabymy",
    "bafybeidcs2frwxv2h2wpv526iibe3vlbm2wo7fvjzqpm5o3oq32hkqlwte",
    "bafybeid4yjs2hx7gjgottu4gktznbbwgqixa7yve7epdrqxro6g7qig2gm",
    "bafybeihsi46l5f7pfqgrj4ldmm6nqjjfmx4ryg4pq6ornzibsgscpqtjau",
    "bafybeickclgl4lf2rc226ah4ltnweobtvzhhndl6y5lte2ibvcukwdigfm",
    "bafybeiauuuk26dbi6hp3grb7xinajiwbwrlxhxh6pgg76bygewfiix7gka",
    "bafybeigcltvclgdajfbrjps2e5fuidwaepkfoaj2zze4emxqc7q4k5xjq4",
    "bafybeiavkrub4h54vpnpqzgnakg4g3zxgfo6x4iadbdn5ul3mqu6pb3dfq"
  ]);
  
  const video = document.getElementById("videoPlayer");
  video.preload = "auto"; // Ensure the video buffers progressively.
  const playBtn = document.getElementById("playBtn");
  const controls = document.getElementById("controls");
  if (!controls) { console.error('Controls element not found'); }
  let currentVideoIndex = -1;
  let isLoading = false;
  let autoplayAttempted = false;
  
  // Preload hidden video element in case it's needed
  const preloadVideo = document.createElement("video");
  preloadVideo.style.display = "none";
  document.body.appendChild(preloadVideo);
  
  /**
   * Returns the URL for a given CID by choosing a random provider.
   */
  function getVideoUrl(cid) {
    const providers = [
      "io",
      "algonode.xyz",
      "eth.aragon.network",
      "dweb.link",
      "flk-ipfs.xyz",
    ];
    const randomProvider =
      providers[Math.floor(Math.random() * providers.length)];
    // Use subdomain format for specific providers
    if (randomProvider === "dweb.link" || randomProvider === "flk-ipfs.xyz") {
      return `https://${cid}.ipfs.${randomProvider}`;
    }
    return `https://ipfs.${randomProvider}/ipfs/${cid}`;
  }
  
  /**
   * Shuffles an array in place and returns it.
   */
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  /**
   * Loads the next video, with retry logic for provider failures.
   */
  async function loadNextVideo() {
    if (isLoading || !videoSources.length) return;
  
    try {
      isLoading = true;
      document.getElementById("spinner").style.display = "block";
      video.pause();
  
      currentVideoIndex = (currentVideoIndex + 1) % videoSources.length;
      const cid = videoSources[currentVideoIndex];

      // Use the new helper to concurrently test providers
      const url = await loadVideoFromCid(cid);
      video.src = url;
      video.load();

      if (!autoplayAttempted) {
        try {
          await video.play();
          autoplayAttempted = true;
        } catch (playError) {
          console.error("Autoplay blocked");
        }
      }
    } catch (error) {
      console.error("Error loading video:", error);
    } finally {
      isLoading = false;
      document.getElementById("spinner").style.display = "none";
    }
  }
  
  // Keyboard controls: toggle play/pause on spacebar press
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      video.paused ? video.play() : video.pause();
      playBtn.style.display = video.paused ? "block" : "none";
    }
  });
  
  // Event listeners for video events and controls
  video.addEventListener("ended", loadNextVideo);
  video.addEventListener("error", loadNextVideo);
  
  playBtn.addEventListener("click", () => {
    video.paused ? video.play() : video.pause();
    playBtn.style.display = video.paused ? "block" : "none";
  });
  
  document.getElementById("nextBtn").addEventListener("click", loadNextVideo);
  
  document.querySelector(".volume-slider").addEventListener("input", (e) => {
    video.volume = e.target.value;
  });
  
  document.getElementById("fullscreenBtn").addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });
  
  // Update progress bar as the video plays
  video.addEventListener("timeupdate", () => {
    const percentage = (video.currentTime / video.duration) * 100;
    document.querySelector(".progress-filled").style.width = `${percentage}%`;
  });
  
  // Update video buffering progress bar
  function updateVideoBuffering() {
    if (video.buffered.length > 0 && video.duration) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const bufferedPercentage = (bufferedEnd / video.duration) * 100;
      document.querySelector(".progress").style.background = `linear-gradient(to right, #ccc ${bufferedPercentage}%, #eee ${bufferedPercentage}%)`;
    }
  }
  video.addEventListener("progress", updateVideoBuffering);
  video.addEventListener("loadedmetadata", updateVideoBuffering);
  
  // Seek video when clicking the progress bar
  document.querySelector(".progress").addEventListener("click", (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPercentage = (e.clientX - rect.left) / rect.width;
    video.currentTime = video.duration * clickPercentage;
  });
  
  // Add new controls logic
  let hideControlsTimeout;

  const showControls = () => {
    controls.style.display = 'block';
    clearTimeout(hideControlsTimeout);
    hideControlsTimeout = setTimeout(() => {
      hideControls();
    }, 1000);
  };

  const hideControls = () => {
    controls.style.display = 'none';
  };

  const togglePlayPause = () => {
    if (video.paused) {
      video.play();
      playBtn.style.display = 'none';
    } else {
      video.pause();
      playBtn.style.display = 'block';
    }
  };

  // Replace the click event handler with a click-count approach
  let clickTimeout = null;
  video.addEventListener('click', (e) => {
    if (!controls) return;
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
      // Double click: toggle fullscreen
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    } else {
      clickTimeout = setTimeout(() => {
        clickTimeout = null;
        // Single click: if controls are hidden, show them, then toggle play/pause
        if (controls.style.display === 'none' || controls.style.display === '') {
          showControls();
        }
        togglePlayPause();
      }, 300);
    }
  });

  // Update pointermove event handler to check for controls and simplify behavior
  video.addEventListener('pointermove', (e) => {
    if (!controls) return;
    clearTimeout(hideControlsTimeout);
    showControls();
  });
  
  // Automatically load the first video if available.
  if (videoSources.length > 0) {
    loadNextVideo();
  } else {
    console.error("No video sources available");
  }

  // Assuming you have something like this in your HTML:
  // <audio id="audioPlayer" src="your_audio_file.mp3"></audio>
  // <div id="seekbar"></div>

  const audio = document.getElementById('audioPlayer');
  const seekbar = document.getElementById('seekbar');

  // Update the seekbar to reflect the buffered amount
  function updateBuffering() {
    if (audio.buffered.length > 0 && audio.duration > 0) {
      // Get the end time of the last buffered range
      const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      // Calculate the percentage of the audio that's been buffered
      const bufferedPercent = (bufferedEnd / audio.duration) * 100;
      // Update the seekbar to show the buffering progress
      // In this example, the seekbar background displays the buffered part in #ccc and the rest in #eee.
      seekbar.style.background = `linear-gradient(to right, #ccc ${bufferedPercent}%, #eee ${bufferedPercent}%)`;
    }
  }

  // Listen for progress events to update buffering visuals
  audio.addEventListener('progress', updateBuffering);
  audio.addEventListener('loadedmetadata', updateBuffering);
  // Optionally update as playback continues
  audio.addEventListener('timeupdate', updateBuffering);

  function loadVideoFromCid(cid) {
    return new Promise((resolve, reject) => {
      const providers = ["io", "algonode.xyz", "eth.aragon.network", "dweb.link", "flk-ipfs.xyz"];
      let resolved = false;
      const testVideos = [];
      let failureCount = 0;

      providers.forEach(provider => {
        const url = (provider === "dweb.link" || provider === "flk-ipfs.xyz")
          ? `https://${cid}.ipfs.${provider}`
          : `https://ipfs.${provider}/ipfs/${cid}`;

        const testVideo = document.createElement("video");

        // Attach event listeners before starting loading
        testVideo.addEventListener("canplay", () => {
          if (!resolved) {
            resolved = true;
            testVideos.forEach(v => v.remove());
            resolve(url);
          }
        }, { once: true });

        testVideo.addEventListener("error", () => {
          failureCount++;
          if (failureCount === providers.length && !resolved) {
            testVideos.forEach(v => v.remove());
            reject(new Error(`All providers failed for CID ${cid}`));
          }
        }, { once: true });

        testVideo.style.display = "none";
        document.body.appendChild(testVideo);

        // Now set src and trigger load after listeners are attached
        testVideo.src = url;
        testVideo.preload = "auto";
        testVideo.load();

        testVideos.push(testVideo);
      });
    });
  }

  // Trigger next button when Enter is pressed
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.click();
        }
    }
  });