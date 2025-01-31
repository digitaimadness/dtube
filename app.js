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
  const playBtn = document.getElementById("playBtn");
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
      let currentUrl = getVideoUrl(cid);
      let retryCount = 0;
  
      const loadVideo = async (url) => {
        video.src = url;
        // Listen for success or error once
        await new Promise((resolve, reject) => {
          video.addEventListener("canplaythrough", resolve, { once: true });
          video.addEventListener("error", reject, { once: true });
        });
      };
  
      while (retryCount < 5) {
        try {
          await loadVideo(currentUrl);
          break;
        } catch (err) {
          retryCount++;
          // Try a different URL for the same CID
          currentUrl = getVideoUrl(cid);
        }
      }
  
      if (retryCount >= 5) throw new Error("all providers failed");
  
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
  
  // Seek video when clicking the progress bar
  document.querySelector(".progress").addEventListener("click", (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPercentage = (e.clientX - rect.left) / rect.width;
    video.currentTime = video.duration * clickPercentage;
  });
  
  // Handle single and double click events on the video for play/pause and fullscreen toggle
  let clickCount = 0;
  video.addEventListener("click", () => {
    clickCount++;
  
    if (clickCount === 1) {
      // Single click: toggle play/pause
      video.paused ? video.play() : video.pause();
      playBtn.style.display = video.paused ? "block" : "none";
    } else if (clickCount === 2) {
      // Double click: toggle fullscreen
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
      clickCount = 0;
    }
  
    setTimeout(() => {
      clickCount = 0;
    }, 300);
  });
  
  // Automatically load the first video if available.
  if (videoSources.length > 0) {
    loadNextVideo();
  } else {
    console.error("No video sources available");
  }