Vue.config.devtools = true

Vue.component('meal-ingredient', {
  template: `<div class="ca-mealingredient"> 
                <span class="tag is-primary ca-counttag">{{ingredient.calorieCount}}</span>
                <span v-if="isFiller" class="tag is-primary ca-fillertag">F</span>
                <img :src="ingredient.imageUrl" />
            </div>`,
  props: ['ingredient', 'isFiller']
})

function readImageUrl(input, handleImage) {
    if (input.files && input.files[0]) {
        var reader = new FileReader()

        reader.onload = function (e) {
          //handleImage('http://i.imgur.com/SmYfo2m.jpg') //random panther with cors enabled
          handleImage(e.target.result)
        }

        reader.readAsDataURL(input.files[0])
    }
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

var currentState = localStorage.getItem('calorix_state_v1')
if(currentState) {
  currentState = JSON.parse(currentState)
} else {
  currentState = { stateVersion : 1, ingredients : [], mealIngredients : [], fillerId: null, calorieTarget : 1800 }
}

function persistState() {
   localStorage.setItem('calorix_state_v1', JSON.stringify(currentState))
}

var mainpageApp = new Vue({
  el: '#wrapper',
  data: {
   ingredientPhotoRaw : null,
   pendingIngredient: null,
   ingredients: currentState.ingredients,
   mealIngredients: currentState.mealIngredients,
   isCropMode : false,
   croppieInstance : null,
   fillerId : currentState.fillerId,
   calorieTarget: currentState.calorieTarget //TODO: Dynamic
  },
  watch: {
    ingredients : function (newIngredients, oldIngredients) {
      currentState.ingredients = newIngredients
      persistState()
    },
    mealIngredients : function (newMealIngredients, oldMealIngredients) {
      currentState.mealIngredients = newMealIngredients
      persistState()
    },    
    fillerId : function (newFillerId, oldFillerId) {
      currentState.fillerId = newFillerId
      persistState()
    }
  },
  methods: {
    takeIngredientPhoto: function () {
      document.getElementById("ingredientPhotoInput").click()
    },
    ingredientPhotoChanged: function (v) {
      var thisLocal = this
      var input = document.getElementById("ingredientPhotoInput")
      if(input.files.length == 1) {
        readImageUrl(input, function(imageUrl) {
          var viewPortWidth = W.getViewportWidth(true);
          var viewPortHeight = W.getViewportHeight(true);
          var minDim = Math.min(viewPortWidth, viewPortHeight)
          //Use these tips for sizing: https://github.com/Foliotek/Croppie/issues/328
          //Orientation: enableExif
          thisLocal.croppieInstance =  new Croppie(document.getElementById('cropTarget'), {
            url: imageUrl,
            enableOrientation: false,
            enableZoom: true,
            showZoomer: true,
            enableExif: true,
            viewport : { width: minDim/4, height: minDim/4, type: 'square' },
            boundary : { width : minDim * 0.5, height: minDim * 0.5 }
          });
          thisLocal.isCropMode = true
        })
      }
    },
    acceptCroppedImage: function () {
      console.log(this)
      this.croppieInstance.result({
        type: 'rawcanvas',
        format: 'png'
      }).then((canvas) => {
        this.pendingIngredient = { imageUrl: canvas.toDataURL(), calorieCount: null, weightInGrams : null, id: guid() }        
        this.isCropMode = false
        this.croppieInstance.destroy()
        this.$forceUpdate()
			})
    },
    cancelCroppedImage: function() {
      this.croppieInstance.destroy()
      this.isCropMode = false
    },
    cancelAddIngredient: function () {
      this.pendingIngredient = null
    },
    commitAddIngredient: function () {
      this.ingredients.push(this.pendingIngredient)
      this.pendingIngredient = null
    },
    isFiller: function(item) {
      return item && this.fillerId === item.id
    },
    toggleFiller: function(item) {
      if(item && item.id !== this.fillerId) {
        this.fillerId = item.id
      } else {
       this.fillerId = null 
      }
    }
  },
  computed: {
    mealCalorieCount : function () {
      var calorieCount = 0
      for(var i=0; i< this.mealIngredients.length; ++i) {
        if(!this.fillerId || this.mealIngredients[i].id != this.fillerId) {
          calorieCount = calorieCount + parseInt(this.mealIngredients[i].calorieCount)
        }
      }
      return calorieCount
    },
    fillerGrams : function () {
      var f = null
      var currentCount = 0
      if(!this.fillerId) {
        return null
      }
      
      for (let item of this.mealIngredients) {
        if(item.id == this.fillerId) {
          f = item
        } else {
          currentCount += item.calorieCount
        }
      }
      
      if(f) {
       if(currentCount < this.calorieTarget) {
         return Math.floor((this.calorieTarget - currentCount) / (f.calorieCount / f.weightInGrams))
       } else {
         return 0
       }
      }
      
      return null
    }
  }
})