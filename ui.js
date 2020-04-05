$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navSubmit = $("#nav-submit");
  const $navUser = $("#nav-user-profile");
  const $userProfile = $("#user-profile");
  const $navFavs = $("#nav-favorites");
  const $favList = $("#favorited-articles");
  const $myStoriesNav = $("#nav-my-stories");

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  /**
   * Event handler for Navigation to Favorites
   */
  $navFavs.on("click", function(){
    hideElements();
    if(currentUser) {
      generateFavs();
      $favList.show();
    }
  });

  $myStoriesNav.on("click", function(){
    hideElements();
    if(currentUser){
      generateMyStories();
      $ownStories.show();
    }
  });

  /**
   * Event handler for Submit click
   */
  $navSubmit.on("click", function(){
    //Show the Story Submit form
    $submitForm.slideToggle();
  });

  /**
   * Event handler for Submit story
   */
  $submitForm.on('submit', async function(evt){
    evt.preventDefault();
    const author = $('#author').val(); 
    const title = $('#title').val(); 
    const url = $('#url').val();
    const hostName = getHostName(url);
    const username = currentUser.username

    const storyObject = await storyList.addStory(currentUser, {
      title,
      author,
      url,
      username
    });
    const $li = $(`
      <li id="${storyObject.storyId}" class="id-${storyObject.storyId}">
        <span class="star">
          <i class="far fa-star"></i>
        </span>
        <a class="article-link" href="${url}" target="a_blank">
          <strong>${title}</strong>
        </a>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-author">by ${author}</small>
        <small class="article-username">posted by ${username}</small>
      </li>
    `);
    $allStoriesList.prepend($li);  
    $submitForm.slideToggle();
    $submitForm.trigger('reset');
  
  });

    /**
   * Event handler for favoriting a story
   */
  $(".articles-list").on('click', ".fa-star", async function(evt){
    if(currentUser) {
      const $targ = $(evt.target);
      const $closest = $targ.closest("li");
      const storyId = $closest.attr("id");
      if($targ.hasClass('fas')){
        await currentUser.removeFavoriteStory(storyId); 
        $targ.closest("i").toggleClass("fas far");
      } else { 
        await currentUser.favoriteStory(storyId);
        $targ.closest("i").toggleClass("fas far");
      }
    } 
  });

  $ownStories.on('click', '#trash', async function(evt){
    const $closestLi = $(evt.target).closest("li");
    const storyId = $closestLi.attr("id");

    await storyList.deleteStory(currentUser, storyId);
    await generateStories();
    hideElements();
    $allStoriesList.show();
  });


  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story, isOwnStory) {
    let hostName = getHostName(story.url);
    let star = checkIfFavorite(story) ? "fas" : "far";

    const trashCan = isOwnStory ? `<span id="trash"><i class="fas fa-trash-alt"></i></span>` : "";
    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        ${trashCan}
        <span id="star">
          <i class="${star} fa-star"></i>
        </span>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  /* populates the favorites list */

function generateFavs() {
    $favList.empty();
    if(currentUser) {
      for(let story of currentUser.favorites) {
        let favoriteLi = generateStoryHTML(story);
        $favList.append(favoriteLi);
      }
    }
  }

  function generateMyStories() {
    $ownStories.empty();
    for(let story of currentUser.ownStories){
      let storyLi = generateStoryHTML(story, true);
      $ownStories.append(storyLi);
    }
    $ownStories.show();
  }

  /* Check if story is a favorite */
  function checkIfFavorite(story) {
    let favStories = new Set();
    if(currentUser) {
      favStories = new Set(currentUser.favorites.map(obj => obj.storyId))
    }
    return favStories.has(story.storyId);
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $userProfile,
      $favList
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $navUser.text(currentUser.username);
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
